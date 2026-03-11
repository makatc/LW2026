import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class VotesApiService {
    constructor(private readonly db: DatabaseService) {}

    async findByBill(billId: string) {
        const votesRes = await this.db.query(
            `SELECT v.id, v.vote_date, v.motion_text, v.result,
                    v.yea_count, v.nay_count, v.abstain_count, v.other_count,
                    v.chamber, v.source_url
             FROM votes v
             WHERE v.measure_id = $1
             ORDER BY v.vote_date DESC`,
            [billId]
        );

        const votes = [];
        for (const vote of votesRes.rows) {
            const ivRes = await this.db.query(
                `SELECT iv.option, iv.legislator_name, l.full_name, l.party, l.district
                 FROM individual_votes iv
                 LEFT JOIN legislators l ON l.id = iv.legislator_id
                 WHERE iv.vote_id = $1
                 ORDER BY iv.option, COALESCE(l.full_name, iv.legislator_name)`,
                [vote.id]
            );
            votes.push({ ...vote, individual_votes: ivRes.rows });
        }

        return votes;
    }

    async getRecent(limit = 10) {
        const res = await this.db.query(
            `SELECT v.id, v.vote_date, v.motion_text, v.result,
                    v.yea_count, v.nay_count, v.chamber,
                    sm.numero, sm.titulo
             FROM votes v
             LEFT JOIN sutra_measures sm ON sm.id = v.measure_id
             ORDER BY v.vote_date DESC NULLS LAST, v.created_at DESC
             LIMIT $1`,
            [limit]
        );
        return res.rows;
    }
}
