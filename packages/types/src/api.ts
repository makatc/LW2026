import { SutraMeasure, MonitorConfig, SutraCommission } from './entities';

// --- Scraper Types ---
export interface ScrapedMeasure {
    numero: string;
    titulo: string;
    fecha: string; // ISO date string or raw
    comision?: string;
    url: string;
    extracto?: string;
}

export const API_VERSION = 'v1';

// --- Common Responses ---
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

// --- Measure API ---
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

// --- Config API ---
export interface CreateConfigDto {
    userId?: string; // Optional for now
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

// --- Dashboard Stats ---
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

