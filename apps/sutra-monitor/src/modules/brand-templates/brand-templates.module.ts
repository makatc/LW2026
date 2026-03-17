import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BrandTemplatesController } from './brand-templates.controller';
import { BrandTemplatesService } from './brand-templates.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      dest: '/tmp/brand-assets',
    }),
  ],
  controllers: [BrandTemplatesController],
  providers: [BrandTemplatesService],
  exports: [BrandTemplatesService],
})
export class BrandTemplatesModule {}
