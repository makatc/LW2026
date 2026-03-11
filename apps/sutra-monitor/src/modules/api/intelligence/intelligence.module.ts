import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntelligenceController } from './intelligence.controller';
import { LegislativeDataIngestionService } from './legislative-data-ingestion.service';
import { LegislatorProfileGeneratorService } from './legislator-profile-generator.service';
import { PositionPredictionService } from './position-prediction.service';

@Module({
    imports: [DatabaseModule],
    controllers: [IntelligenceController],
    providers: [
        LegislativeDataIngestionService,
        LegislatorProfileGeneratorService,
        PositionPredictionService,
    ],
    exports: [
        LegislativeDataIngestionService,
        LegislatorProfileGeneratorService,
        PositionPredictionService,
    ],
})
export class IntelligenceModule {}
