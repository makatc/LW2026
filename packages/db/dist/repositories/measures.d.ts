import { SutraMeasure, SutraMeasureSnapshot, IngestRun } from '@lwbeta/types';
export declare class MeasureRepository {
    upsertMeasure(measure: Partial<SutraMeasure>): Promise<SutraMeasure>;
    findByNumero(numero: string): Promise<SutraMeasure | null>;
    createSnapshot(snapshot: Partial<SutraMeasureSnapshot>): Promise<SutraMeasureSnapshot>;
    createIngestRun(status: string): Promise<IngestRun>;
    updateIngestRun(id: string, updates: Partial<IngestRun>): Promise<IngestRun>;
}
