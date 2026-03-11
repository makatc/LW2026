import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../auth/decorators';
import { LegislativeDataIngestionService } from './legislative-data-ingestion.service';
import { LegislatorProfileGeneratorService } from './legislator-profile-generator.service';
import { PositionPredictionService } from './position-prediction.service';

@Controller('api/intelligence')
@Public()
export class IntelligenceController {
    constructor(
        private readonly ingestion: LegislativeDataIngestionService,
        private readonly profileGenerator: LegislatorProfileGeneratorService,
        private readonly positionPredictor: PositionPredictionService,
    ) {}

    // ─── Task 2.1: OSLPR Data Ingestion ───────────────────────────────────────

    /**
     * POST /api/intelligence/legislators/:id/ingest
     * Triggers OSLPR data ingestion for a specific legislator.
     * In production this would be a BullMQ job; for now runs inline.
     */
    @Post('legislators/:id/ingest')
    async ingestLegislatorData(@Param('id') legislatorId: string) {
        return this.ingestion.ingestForLegislator(legislatorId);
    }

    /**
     * POST /api/intelligence/ingest-all
     * Triggers batch ingestion for all active legislators.
     */
    @Post('ingest-all')
    async ingestAll() {
        return this.ingestion.ingestAll();
    }

    /**
     * GET /api/intelligence/legislators/:id/historical-data
     * Returns raw ingested data for a legislator.
     */
    @Get('legislators/:id/historical-data')
    async getHistoricalData(@Param('id') legislatorId: string) {
        return this.ingestion.getHistoricalData(legislatorId);
    }

    // ─── Task 2.2: AI Profile Generation ──────────────────────────────────────

    /**
     * POST /api/intelligence/legislators/:id/generate-profile
     * Uses Gemini to generate thematic footprint, topic positions, etc.
     * Requires historical data to be ingested first.
     */
    @Post('legislators/:id/generate-profile')
    async generateProfile(@Param('id') legislatorId: string) {
        return this.profileGenerator.generateProfile(legislatorId);
    }

    /**
     * POST /api/intelligence/generate-all-profiles
     * Batch generates profiles for all legislators with historical data.
     */
    @Post('generate-all-profiles')
    async generateAllProfiles() {
        return this.profileGenerator.generateAllProfiles();
    }

    // ─── Task 2.3: Position Prediction ────────────────────────────────────────

    /**
     * GET /api/intelligence/legislators/:id/predict-position/:measureId
     * Predicts a legislator's position on a specific measure using Gemini.
     */
    @Get('legislators/:id/predict-position/:measureId')
    async predictPosition(
        @Param('id') legislatorId: string,
        @Param('measureId') measureId: string,
    ) {
        return this.positionPredictor.predictPosition(legislatorId, measureId);
    }

    /**
     * POST /api/intelligence/predict-positions-for-measure/:measureId
     * Predicts positions for ALL active legislators on a measure.
     */
    @Post('predict-positions-for-measure/:measureId')
    async predictPositionsForMeasure(@Param('measureId') measureId: string) {
        return this.positionPredictor.predictForAllLegislators(measureId);
    }
}
