import { SutraMeasure, MonitorConfig } from './entities';
export interface ScrapedMeasure {
    numero: string;
    titulo: string;
    fecha: string;
    comision?: string;
    url: string;
    extracto?: string;
}
export declare const API_VERSION = "v1";
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export interface ApiResponse<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface SearchMeasuresDto {
    query?: string;
    commissionId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export interface MeasureDetailResponse extends SutraMeasure {
    snapshots: Array<{
        captured_at: Date;
        change_type: string;
        hash: string;
    }>;
}
export interface CreateConfigDto {
    userId?: string;
    keywords: string[];
    phrases: string[];
    commissionIds: string[];
}
export interface UpdateConfigDto extends Partial<CreateConfigDto> {
    enabled?: boolean;
}
export interface ConfigResponse extends MonitorConfig {
    stats: {
        totalHits: number;
        lastHitAt?: Date;
    };
}
export interface DashboardStats {
    totalMeasures: number;
    measuresToday: number;
    activeAlerts: number;
    recentHits: Array<{
        measureId: string;
        measureTitle: string;
        hitType: string;
        detectedAt: Date;
    }>;
}
