"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@lwbeta/db");
const sutra_scraper_1 = require("../../scraper/sutra.scraper");
let ConfigService = exports.ConfigService = class ConfigService {
    constructor(configRepo, commissionRepo, scraper) {
        this.configRepo = configRepo;
        this.commissionRepo = commissionRepo;
        this.scraper = scraper;
    }
    async fetchRemoteCommissions() {
        const names = await this.scraper.scrapeCommissionsList();
        const results = [];
        for (const name of names) {
            if (!name)
                continue;
            try {
                // @ts-ignore - method added recently
                const comm = await this.commissionRepo.upsert(name);
                results.push(comm);
            }
            catch (e) {
                console.error(`Failed to upsert commission ${name}`, e);
            }
        }
        return results;
    }
    async getAllCommissions() {
        return this.commissionRepo.listall();
    }
    async getMyConfig(userId) {
        return this.configRepo.getOrCreateDefaultConfig(userId);
    }
    async updateWebhooks(userId, data) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.updateWebhooks(config.id, data.alertsUrl, data.updatesUrl);
    }
    async getAllActiveRules() {
        return this.configRepo.getAllActiveRules();
    }
    async addKeyword(userId, keyword) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addKeywordRule(config.id, keyword);
    }
    async getKeywords(userId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getKeywords(config.id);
    }
    async deleteKeyword(userId, id) {
        await this.configRepo.deleteKeywordRule(id);
    }
    // Phrases
    async addPhrase(userId, phrase) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addPhraseRule(config.id, phrase);
    }
    async getPhrases(userId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getPhraseRules(config.id);
    }
    async deletePhrase(userId, id) {
        await this.configRepo.deletePhraseRule(id);
    }
    // Commissions
    async followCommission(userId, commissionId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.followCommission(config.id, commissionId);
    }
    async unfollowCommission(userId, commissionId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.unfollowCommission(config.id, commissionId);
    }
    async getFollowedCommissions(userId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getFollowedCommissions(config.id);
    }
    // Watchlist
    async addToWatchlist(userId, measureId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.addToWatchlist(config.id, measureId, 'MANUAL');
    }
    async addToWatchlistByNumber(userId, measureNumber) {
        const config = await this.getMyConfig(userId);
        // We pass null as measureId, and let the repo handle inserting the number
        // Ideally we would try to look it up first, but for now we just store the number
        // and let the ingestion process resolve it later or immediate lookup if implemented.
        return this.configRepo.addToWatchlist(config.id, null, 'MANUAL', measureNumber);
    }
    async getWatchlist(userId) {
        const config = await this.getMyConfig(userId);
        return this.configRepo.getWatchlist(config.id);
    }
    async removeFromWatchlist(userId, measureId) {
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
                    }
                    catch (err) {
                        console.error(`Failed to upsert "${name}":`, err.message);
                        throw err; // Re-throw to stop processing
                    }
                }
            }
            console.log(`✅ Successfully seeded ${results.length} commissions`);
            return results;
        }
        catch (error) {
            console.error('❌ Error in seedOfficialCommissions:', error);
            throw error; // Propagate to controller
        }
    }
    async getEmailPreferences(configId) {
        return this.configRepo.getEmailPreferences(configId);
    }
    async updateEmailPreferences(configId, enabled, frequency) {
        return this.configRepo.updateEmailPreferences(configId, enabled, frequency);
    }
};
exports.ConfigService = ConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.ConfigRepository,
        db_1.CommissionRepository,
        sutra_scraper_1.SutraScraper])
], ConfigService);
//# sourceMappingURL=config.service.js.map