"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeasureRepository = void 0;
const client_1 = require("../client");
class MeasureRepository {
    async upsertMeasure(measure) {
        const { numero, titulo, extracto, comision_id, fecha, source_url, hash } = measure;
        const result = await client_1.pool.query(`INSERT INTO sutra_measures (numero, titulo, extracto, comision_id, fecha, source_url, hash, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (numero) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         extracto = EXCLUDED.extracto,
         comision_id = EXCLUDED.comision_id,
         fecha = EXCLUDED.fecha,
         source_url = EXCLUDED.source_url,
         hash = EXCLUDED.hash,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING *`, [numero, titulo, extracto, comision_id, fecha, source_url, hash]);
        return result.rows[0];
    }
    async findByNumero(numero) {
        const result = await client_1.pool.query('SELECT * FROM sutra_measures WHERE numero = $1', [numero]);
        return result.rows[0] || null;
    }
    async createSnapshot(snapshot) {
        const { measure_id, source_url, hash, change_type, ingest_run_id } = snapshot;
        const result = await client_1.pool.query(`INSERT INTO sutra_measure_snapshots (measure_id, source_url, hash, change_type, ingest_run_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [measure_id, source_url, hash, change_type, ingest_run_id]);
        return result.rows[0];
    }
    async createIngestRun(status) {
        const result = await client_1.pool.query(`INSERT INTO ingest_runs (status) VALUES ($1) RETURNING *`, [status]);
        return result.rows[0];
    }
    async updateIngestRun(id, updates) {
        // Dynamic update query builder could be better, but keeping it simple for now
        const result = await client_1.pool.query(`UPDATE ingest_runs SET 
            status = COALESCE($2, status),
            ended_at = $3,
            measures_found = COALESCE($4, measures_found),
            measures_new = COALESCE($5, measures_new),
            measures_updated = COALESCE($6, measures_updated),
            error_message = $7
           WHERE id = $1 RETURNING *`, [id, updates.status, updates.ended_at, updates.measures_found, updates.measures_new, updates.measures_updated, updates.error_message]);
        return result.rows[0];
    }
}
exports.MeasureRepository = MeasureRepository;
