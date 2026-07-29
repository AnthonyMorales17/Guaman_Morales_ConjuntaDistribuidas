import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { WinesAdminController } from './wines-admin.controller';
import { EstablishmentsAdminController } from './establishments-admin.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, WinesAdminController, EstablishmentsAdminController],
  providers: [CatalogService],
})
export class CatalogModule {}
