import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateWineDto } from './dto/create-wine.dto';
import { UpdateWineDto } from './dto/update-wine.dto';

@ApiTags('wines-admin')
@Controller('wines')
export class WinesAdminController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un vino (admin)' })
  create(@Body() dto: CreateWineDto) {
    return this.catalogService.createWine(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un vino (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateWineDto) {
    return this.catalogService.updateWine(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un vino (admin)' })
  delete(@Param('id') id: string) {
    return this.catalogService.deleteWine(id);
  }
}
