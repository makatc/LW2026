"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DatabaseMigrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseMigrationService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@lwbeta/db");
let DatabaseMigrationService = exports.DatabaseMigrationService = DatabaseMigrationService_1 = class DatabaseMigrationService {
    constructor() {
        this.logger = new common_1.Logger(DatabaseMigrationService_1.name);
    }
    async onModuleInit() {
        await this.runMigrations();
    }
    async runMigrations() {
        try {
            this.logger.log('🚀 Starting Database Migration & Seeding...');
            this.logger.log('1. Adding category column...');
            await db_1.pool.query(`
                ALTER TABLE sutra_commissions 
                ADD COLUMN IF NOT EXISTS category VARCHAR(50)
            `);
            this.logger.log('✅ Schema updated (category column)');
            // 2. CLEAR ALL EXISTING COMMISSIONS (to remove old/bad data)
            await db_1.pool.query('DELETE FROM sutra_commissions');
            this.logger.log('🧹 Cleared old commissions');
            // 3. SEED OFFICIAL COMMISSIONS (2025-2028)
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
            let count = 0;
            for (const [category, names] of Object.entries(commissions)) {
                for (const name of names) {
                    const slug = name.toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
                        .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with dashes
                        .replace(/^-+|-+$/g, ''); // trim dashes
                    await db_1.pool.query(`INSERT INTO sutra_commissions (name, slug, category) 
                         VALUES ($1, $2, $3)
                         ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category`, [name, slug, category]);
                    count++;
                }
            }
            this.logger.log(`🎉 Successfully seeded ${count} official commissions`);
        }
        catch (error) {
            this.logger.error('❌ Migration/Seeding failed:', error.message);
        }
    }
};
exports.DatabaseMigrationService = DatabaseMigrationService = DatabaseMigrationService_1 = __decorate([
    (0, common_1.Injectable)()
], DatabaseMigrationService);
//# sourceMappingURL=database-migration.service.js.map