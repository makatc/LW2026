import { pool } from '../client';
import { Vote, IndividualVote } from '@lwbeta/types';

export class VoteRepository {
    async findByMeasure(measureId: string): Promise<Vote[]> {
        const result = await pool.query(
            `SELECT * FROM votes WHERE measure_id = $1 ORDER BY vote_date DESC NULLS LAST`,
            [measureId],
        );
        return result.rows;
    }

    async findByMeasureNumero(numero: string): Promise<Vote[]> {
        const result = await pool.query(
            `SELECT v.*
             FROM votes v
             JOIN sutra_measures sm ON sm.id = v.measure_id
             WHERE sm.numero = $1
             ORDER BY v.vote_date DESC NULLS LAST`,
            [numero],
        );
        return result.rows;
    }

    async findById(id: string): Promise<Vote | null> {
        const result = await pool.query('SELECT * FROM votes WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }

    async getIndividualVotes(voteId: string): Promise<(IndividualVote & { full_name?: string; party?: string })[]> {
        const result = await pool.query(
            `SELECT iv.*, l.full_name, l.party
             FROM individual_votes iv
             LEFT JOIN legislators l ON l.id = iv.legislator_id
             WHERE iv.vote_id = $1
             ORDER BY iv.option, iv.legislator_name`,
            [voteId],
        );
        return result.rows;
    }

    async getLegislatorVoteHistory(legislatorId: string, limit = 20): Promise<any[]> {
        const result = await pool.query(
            `SELECT iv.option, v.vote_date, v.motion_text, v.result, v.chamber,
                    sm.numero, sm.titulo
             FROM individual_votes iv
             JOIN votes v ON v.id = iv.vote_id
             LEFT JOIN sutra_measures sm ON sm.id = v.measure_id
             WHERE iv.legislator_id = $1
             ORDER BY v.vote_date DESC NULLS LAST
             LIMIT $2`,
            [legislatorId, limit],
        );
        return result.rows;
    }

    async getRecentVotes(options: {
        chamber?: 'upper' | 'lower';
        result?: 'pass' | 'fail';
        limit?: number;
    } = {}): Promise<Vote[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (options.chamber) {
            params.push(options.chamber);
            conditions.push(`chamber = $${params.length}`);
        }
        if (options.result) {
            params.push(options.result);
            conditions.push(`result = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit ?? 50;
        params.push(limit);

        const res = await pool.query(
            `SELECT v.*, sm.numero, sm.titulo
             FROM votes v
             LEFT JOIN sutra_measures sm ON sm.id = v.measure_id
             ${where}
             ORDER BY v.vote_date DESC NULLS LAST
             LIMIT $${params.length}`,
            params,
        );
        return res.rows;
    }
}
