import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';

@ApiTags('establishments-admin')
@Controller('establishments')
export class EstablishmentsAdminController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un establecimiento (admin)' })
  create(@Body() dto: CreateEstablishmentDto) {
    return this.catalogService.createEstablishment(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un establecimiento (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateEstablishmentDto) {
    return this.catalogService.updateEstablishment(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un establecimiento (admin)' })
  delete(@Param('id') id: string) {
    return this.catalogService.deleteEstablishment(id);
  }
}
