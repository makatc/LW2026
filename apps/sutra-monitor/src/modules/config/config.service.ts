import { Injectable } from '@nestjs/common';
import { ConfigRepository, CommissionRepository } from '@lwbeta/db';
import { KeywordRule, MonitorConfig } from '@lwbeta/types';
import { SutraScraper } from '../../scraper/sutra.scraper';

@Injectable()
export class ConfigService {
    constructor(
        private readonly configRepo: ConfigRepository,
        private readonly commissionRepo: CommissionRepository,
        private readonly scraper: SutraScraper
    ) { }

    async fetchRemoteCommissions() {
        const names = await this.scraper.scrapeCommissionsList();
        const results = [];
        for (const name of names) {
            if (!name) continue;
            try {
                // @ts-ignore - method added recently
                const comm = await this.commissionRepo.upsert(name);
                results.push(comm);
            } catch (e) {
                console.error(`Failed to upsert commission ${name}`, e);
            }
        }
        return results;
    }

    async getAllCommissions() {
        return this.commissionRepo.listall();
    }

    async getMyConfig(userId?: string): Promise<MonitorConfig> {
        return this.configRepo.getOrCreateDefaultConfig(userId);
    }

    async updateWebhooks(userId: string | undefined, data: { alertsUrl: string, updatesUrl: string }) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.updateWebhooks(config.id, data.alertsUrl, data.updatesUrl);
    }

    async getAllActiveRules(): Promise<KeywordRule[]> {
        return this.configRepo.getAllActiveRules();
    }

    async addKeyword(userId: string | undefined, keyword: string): Promise<KeywordRule> {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addKeywordRule(config.id, keyword);
    }

    async getKeywords(userId?: string): Promise<KeywordRule[]> {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getKeywords(config.id);
    }

    async deleteKeyword(userId: string | undefined, id: string): Promise<void> {
        await this.configRepo.deleteKeywordRule(id);
    }

    // Phrases
    async addPhrase(userId: string | undefined, phrase: string) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addPhraseRule(config.id, phrase);
    }

    async getPhrases(userId?: string) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getPhraseRules(config.id);
    }

    async deletePhrase(userId: string | undefined, id: string) {
        await this.configRepo.deletePhraseRule(id);
    }

    // Commissions
    async followCommission(userId: string | undefined, commissionId: string) {
        const config = await this.getMyConfig(userId);
        console.log(`[ConfigService] User ${userId} is following commission ${commissionId} using config ${config.id}`);
        return this.configRepo.followCommission(config.id, commissionId);
    }

    async unfollowCommission(userId: string | undefined, commissionId: string) {
        const config = await this.getMyConfig(userId);
        console.log(`[ConfigService] User ${userId} is unfollowing commission ${commissionId} using config ${config.id}`);
        return this.configRepo.unfollowCommission(config.id, commissionId);
    }

    async getFollowedCommissions(userId?: string) {
        const config = await this.getMyConfig(userId);
        console.log(`[ConfigService] Fetching followed commissions for User ${userId} using config ${config.id}`);
        return this.configRepo.getFollowedCommissions(config.id);
    }

    // Watchlist
    async addToWatchlist(userId: string | undefined, measureId: string) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addToWatchlist(config.id, measureId, 'MANUAL');
    }

    async addToWatchlistByNumber(userId: string | undefined, measureNumber: string) {
        const config = await this.getMyConfig(userId);
        // We pass null as measureId, and let the repo handle inserting the number
        // Ideally we would try to look it up first, but for now we just store the number
        // and let the ingestion process resolve it later or immediate lookup if implemented.
        return this.configRepo.addToWatchlist(config.id, null, 'MANUAL', measureNumber);
    }

    async getWatchlist(userId?: string) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getWatchlist(config.id);
    }


    async removeFromWatchlist(userId: string | undefined, measureId: string) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.removeFromWatchlist(config.id, measureId);
    }

    async seedOfficialCommissions() {
        try {
            console.log('🌱 Starting seedOfficialCommissions...');

            const commissions = {
                'Comisiones Conjuntas': [
                    'Comisión Conjunta de la Asamblea Legislativa para la Revisión del Sistema Electoral de Puerto Rico',
                    'Comisión Conjunta para la Revisión Continua del Código Penal y para la Reforma de las Leyes Penales',
                    'Comisión Conjunta para la Revisión e Implementación de Reglamentos Administrativos',
                    'Comisión Conjunta para las Alianzas Público-Privadas de la Asamblea Legislativa',
                    'Comisión Conjunta Permanente para la Revisión y Reforma del Código Civil de Puerto Rico',
                    'Comisión Conjunta sobre Informes Especiales del Contralor',
                    'Comisión Conjunta sobre Mitigación, Adaptación y Resiliencia al Cambio Climático',
                    'Comisión Especial Conjunta de Fondos Legislativos para Impacto Comunitario'
                ],
                'Cámara de Representantes': [
                    'Comisión de Adultos Mayores y Bienestar Social',
                    'Comisión de Agricultura',
                    'Comisión de Asuntos de la Juventud',
                    'Comisión de Asuntos de la Mujer',
                    'Comisión de Asuntos del Consumidor',
                    'Comisión de Asuntos Federales y Veteranos',
                    'Comisión de Asuntos Internos',
                    'Comisión de Asuntos Municipales',
                    'Comisión de Banca, Seguros y Comercio',
                    'Comisión de Cooperativismo',
                    'Comisión de Desarrollo Económico',
                    'Comisión de Educación',
                    'Comisión de Gobierno',
                    'Comisión de Hacienda',
                    'Comisión de Lo Jurídico',
                    'Comisión de Pequeños y Medianos Negocios',
                    'Comisión de Recreación y Deportes',
                    'Comisión de Recursos Naturales',
                    'Comisión de Reorganización, Eficiencia y Diligencia',
                    'Comisión de Salud',
                    'Comisión de Seguridad Pública',
                    'Comisión de Sistemas de Retiro',
                    'Comisión de Transportación e Infraestructura',
                    'Comisión de Turismo',
                    'Comisión de Vivienda y Desarrollo Urbano',
                    'Comisión del Trabajo y Asuntos Laborales',
                    'Comisión de la Región Central',
                    'Comisión de la Región Este',
                    'Comisión de la Región Este Central',
                    'Comisión de la Región Metro',
                    'Comisión de la Región Norte',
                    'Comisión de la Región Oeste',
                    'Comisión de la Región Sur'
                ],
                'Senado': [
                    'Comisión de Agricultura',
                    'Comisión de Asuntos Internos',
                    'Comisión de Asuntos Municipales',
                    'Comisión de Ciencia, Tecnología e Inteligencia Artificial',
                    'Comisión de Desarrollo Económico, Pequeños Negocios, Banca, Comercio, Seguros y Cooperativismo',
                    'Comisión de Educación, Arte y Cultura',
                    'Comisión de Ética',
                    'Comisión de Familia, Asuntos de la Mujer, Personas de la Tercera Edad y Población con Diversidad Funcional e Impedimentos',
                    'Comisión de Gobierno',
                    'Comisión de Hacienda, Presupuesto y PROMESA',
                    'Comisión de Innovación, Reforma y Nombramientos',
                    'Comisión de Juventud, Recreación y Deportes',
                    'Comisión De Lo Jurídico',
                    'Comisión de Planificación, Permisos, Infraestructura y Urbanismo',
                    'Comisión de Relaciones Federales y Viabilización del Mandato del Pueblo para la Solución del Status',
                    'Comisión de Salud',
                    'Comisión de Seguridad Pública y Asuntos del Veterano',
                    'Comisión De Trabajo y Relaciones Laborales',
                    'Comisión de Transportación, Telecomunicaciones, Servicios Públicos y Asuntos del Consumidor',
                    'Comisión de Turismo, Recursos Naturales y Ambientales',
                    'Comisión de Vivienda y Bienestar Social'
                ]
            };

            const results = [];
            for (const [category, names] of Object.entries(commissions)) {
                console.log(`Processing category: ${category} (${names.length} commissions)`);
                for (const name of names) {
                    try {
                        const comm = await this.commissionRepo.upsert(name, category);
                        results.push(comm);
                    } catch (err) {
                        console.error(`Failed to upsert "${name}":`, (err as any).message);
                        throw err; // Re-throw to stop processing
                    }
                }
            }

            console.log(`✅ Successfully seeded ${results.length} commissions`);
            return results;
        } catch (error) {
            console.error('❌ Error in seedOfficialCommissions:', error);
            throw error; // Propagate to controller
        }
    }

    async getEmailPreferences(configId: string) {
        return this.configRepo.getEmailPreferences(configId);
    }

    async updateEmailPreferences(configId: string, enabled: boolean, frequency: 'daily' | 'weekly') {
        return this.configRepo.updateEmailPreferences(configId, enabled, frequency);
    }
}
