import { PartialType } from '@nestjs/swagger';
import { CreateWineDto } from './create-wine.dto';

export class UpdateWineDto extends PartialType(CreateWineDto) {}
