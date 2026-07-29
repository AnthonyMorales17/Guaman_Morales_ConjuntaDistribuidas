import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ListWinesQueryDto } from './dto/list-wines-query.dto';
import { CreateWineDto } from './dto/create-wine.dto';
import { UpdateWineDto } from './dto/update-wine.dto';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';

type AggRow = { wineId: string | null; _avg: { rating: number | null }; _count: { _all: number } };

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  private buildWhere(query: ListWinesQueryDto): Prisma.WineWhereInput {
    const where: Prisma.WineWhereInput = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { grape: { contains: query.q, mode: 'insensitive' } },
        { origin: { contains: query.q, mode: 'insensitive' } },
        { wineryName: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.country) where.country = query.country;
    if (query.grape) where.grape = query.grape;
    if (query.priceMin != null || query.priceMax != null) {
      where.referencePrice = {};
      if (query.priceMin != null) (where.referencePrice as Prisma.DecimalFilter).gte = query.priceMin;
      if (query.priceMax != null) (where.referencePrice as Prisma.DecimalFilter).lte = query.priceMax;
    }
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.WineOrderByWithRelationInput | Prisma.WineOrderByWithRelationInput[] {
    switch (sort) {
      case 'precio_asc': return { referencePrice: 'asc' };
      case 'precio_desc': return { referencePrice: 'desc' };
      case 'nombre': return { name: 'asc' };
      case 'calificacion':
      case 'relevancia':
      default:
        return [{ criticScore: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }];
    }
  }

  private toCard(w: any, agg?: AggRow) {
    const offers = (w.availabilities || [])
      .map((a: any) => ({
        establishmentId: a.establishmentId,
        storeName: a.establishment?.name ?? '',
        address: a.establishment?.address ?? '',
        price: Number(a.price),
        lat: a.establishment?.lat,
        lng: a.establishment?.lng,
        status: a.status,
      }))
      .sort((x: any, y: any) => x.price - y.price);
    return {
      id: w.id,
      name: w.name,
      wineryName: w.wineryName,
      type: w.type,
      grape: w.grape,
      origin: w.origin,
      country: w.country,
      vintage: w.vintage,
      criticScore: w.criticScore,
      imageUrl: w.imageUrl,
      referencePrice: Number(w.referencePrice),
      bestPrice: offers.length ? offers[0].price : Number(w.referencePrice),
      storeCount: offers.length,
      offers,
      avgRating: agg && agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      reviewCount: agg ? agg._count._all : 0,
    };
  }

  private async aggregateReviews(wineIds: string[]): Promise<Map<string, AggRow>> {
    if (!wineIds.length) return new Map();
    const rows = (await this.prisma.review.groupBy({
      by: ['wineId'],
      where: { wineId: { in: wineIds }, targetType: 'WINE' },
      _avg: { rating: true },
      _count: { _all: true },
    })) as unknown as AggRow[];
    return new Map(rows.filter((r) => r.wineId).map((r) => [r.wineId as string, r]));
  }

  async listWines(query: ListWinesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(query.pageSize) || 24));
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [total, wines] = await this.prisma.$transaction([
      this.prisma.wine.count({ where }),
      this.prisma.wine.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { availabilities: { include: { establishment: true } } },
      }),
    ]);

    const aggMap = await this.aggregateReviews(wines.map((w) => w.id));
    const items = wines.map((w) => this.toCard(w, aggMap.get(w.id)));
    return { items, total, page, pageSize };
  }

  async getWine(id: string) {
    const wine = await this.prisma.wine.findUnique({
      where: { id },
      include: { availabilities: { include: { establishment: true } } },
    });
    if (!wine) throw new NotFoundException('Vino no encontrado');
    const aggMap = await this.aggregateReviews([wine.id]);
    return {
      ...this.toCard(wine, aggMap.get(wine.id)),
      tastingNote: wine.tastingNote,
      pairing: wine.pairing,
      denominationOfOrigin: wine.denominationOfOrigin,
      aging: wine.aging,
    };
  }

  async facets() {
    const [types, countries, grapes] = await Promise.all([
      this.prisma.wine.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.wine.groupBy({ by: ['country'], _count: { _all: true } }),
      this.prisma.wine.groupBy({ by: ['grape'], _count: { _all: true } }),
    ]);
    const fmt = (rows: any[], key: string, limit?: number) => {
      const out = rows
        .filter((r) => r[key])
        .map((r) => ({ key: r[key] as string, count: r._count._all as number }))
        .sort((a, b) => b.count - a.count);
      return limit ? out.slice(0, limit) : out;
    };
    return {
      types: fmt(types, 'type'),
      countries: fmt(countries, 'country', 20),
      grapes: fmt(grapes, 'grape', 30),
    };
  }

  async bestsellers(limit = 10) {
    const wines = await this.prisma.wine.findMany({
      orderBy: [{ criticScore: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      take: limit,
      include: { availabilities: { include: { establishment: true } } },
    });
    const aggMap = await this.aggregateReviews(wines.map((w) => w.id));
    return wines.map((w) => this.toCard(w, aggMap.get(w.id)));
  }

  // ─── Wine CRUD (Admin) ───────────────────────────────────────────

  async createWine(dto: CreateWineDto) {
    const wine = await this.prisma.wine.create({ data: dto as any });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Wine',
        action: 'CREATE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { after: wine },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for createWine', err);
    }
    return wine;
  }

  async updateWine(id: string, dto: UpdateWineDto) {
    const existing = await this.prisma.wine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vino no encontrado');
    const wine = await this.prisma.wine.update({ where: { id }, data: dto as any });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Wine',
        action: 'UPDATE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { before: existing, after: wine },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for updateWine', err);
    }
    return wine;
  }

  async deleteWine(id: string) {
    const existing = await this.prisma.wine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vino no encontrado');
    await this.prisma.wine.delete({ where: { id } });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Wine',
        action: 'DELETE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { before: existing },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for deleteWine', err);
    }
    return { deleted: true };
  }

  // ─── Establishment CRUD (Admin) ──────────────────────────────────

  async createEstablishment(dto: CreateEstablishmentDto) {
    const establishment = await this.prisma.establishment.create({ data: dto as any });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Establishment',
        action: 'CREATE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { after: establishment },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for createEstablishment', err);
    }
    return establishment;
  }

  async updateEstablishment(id: string, dto: UpdateEstablishmentDto) {
    const existing = await this.prisma.establishment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Establecimiento no encontrado');
    const establishment = await this.prisma.establishment.update({ where: { id }, data: dto as any });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Establishment',
        action: 'UPDATE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { before: existing, after: establishment },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for updateEstablishment', err);
    }
    return establishment;
  }

  async deleteEstablishment(id: string) {
    const existing = await this.prisma.establishment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Establecimiento no encontrado');
    await this.prisma.establishment.delete({ where: { id } });
    try {
      await this.rabbitmq.publishAuditEvent({
        entity: 'Establishment',
        action: 'DELETE',
        userId: 'admin',
        userEmail: 'admin@cavalocal.com',
        timestamp: new Date().toISOString(),
        data: { before: existing },
      });
    } catch (err) {
      this.logger.warn('Failed to publish audit event for deleteEstablishment', err);
    }
    return { deleted: true };
  }
}
