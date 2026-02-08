export interface ScrapedMeasure {
    numero: string;
    url: string;
    titulo: string;
    fecha: string;
    commission?: string | null;
    extracto?: string;
    author?: string | null;
}
