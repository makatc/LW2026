// ARQUITECTURA: Motor de scoring determinístico con pesos fijos (v1.0)
// Decisión: reglas hardcoded vs ML — se elige determinístico porque:
// 1. No hay suficiente data histórica de PR para entrenar un modelo
// 2. Los factores son conocidos y documentados en literatura legislativa de PR
// 3. El modelo mejora con el tiempo acumulando datos en viability_historical_data
// 4. Migración a ML prevista cuando haya ≥500 medidas con outcome conocido

export interface ScoringFactor {
  factor: string;
  weight: number;
  delta: number;
  description: string;
}

export interface ViabilityScore {
  total_score: number;
  score_breakdown: ScoringFactor[];
  confidence_level: 'low' | 'medium' | 'high';
  factors_with_data: number;
  total_factors: number;
}

export interface ViabilityCalculatorParams {
  bill: any;           // sutra_measures row
  legislators: any[];  // legislators table
  committees: any[];   // committees table
  fiscalNotes: any[];  // fiscal_notes rows for this bill
  fombActions: any[];  // fomb_actions rows for this bill
  historicalBills: any[]; // similar bills for thematic rate
  sessionDaysRemaining: number;
  isElectoralYear: boolean;
}

const TOTAL_FACTORS = 7;
// Base score = 50 — neutral starting point
const BASE_SCORE = 50;

export class ViabilityScoreCalculator {
  calculate(params: ViabilityCalculatorParams): ViabilityScore {
    const {
      bill,
      legislators,
      committees,
      fiscalNotes,
      fombActions,
      historicalBills,
      sessionDaysRemaining,
      isElectoralYear,
    } = params;

    const factors: ScoringFactor[] = [
      this.scoreAuthorPartyMajority(bill, legislators),
      this.scoreCommitteeChairHistory(bill, committees, historicalBills),
      this.scoreBipartisanCosponsors(bill, legislators),
      this.scoreSessionTiming(sessionDaysRemaining, isElectoralYear),
      this.scoreFiscalNote(fiscalNotes),
      this.scoreFombStatus(fombActions),
      this.scoreThematicApprovalRate(historicalBills),
    ];

    // Count factors that actually contributed data (non-zero weight means data was available)
    const factorsWithData = factors.filter(f => f.delta !== 0 || f.weight > 0).length;

    const totalDelta = factors.reduce((sum, f) => sum + f.delta, 0);
    const rawScore = BASE_SCORE + totalDelta;
    // Clamp to 0–100
    const total_score = Math.max(0, Math.min(100, rawScore));

    return {
      total_score,
      score_breakdown: factors,
      confidence_level: this.calculateConfidence(factorsWithData),
      factors_with_data: factorsWithData,
      total_factors: TOTAL_FACTORS,
    };
  }

  // ─── Factor 1: Author party majority ────────────────────────────────────────
  // +20 if author party has majority in the bill's chamber
  // +10 if allied party
  // -10 if minority
  private scoreAuthorPartyMajority(bill: any, legislators: any[]): ScoringFactor {
    const factor = 'author_party_majority';
    const weight = 20;

    if (!bill || !legislators || legislators.length === 0) {
      return { factor, weight, delta: 0, description: 'Insufficient legislator data' };
    }

    // Determine bill chamber from bill_type prefix
    const billNumber: string = bill.numero || bill.bill_number || '';
    let chamber: 'upper' | 'lower' | null = null;
    if (/^PS/i.test(billNumber) || /^RC\d/i.test(billNumber)) chamber = 'upper';
    else if (/^PC/i.test(billNumber) || /^RCC/i.test(billNumber)) chamber = 'lower';
    // Fallback: use bill.chamber if present
    if (!chamber && bill.chamber) chamber = bill.chamber;

    const chamberLegislators = chamber
      ? legislators.filter((l: any) => l.chamber === chamber)
      : legislators;

    if (chamberLegislators.length === 0) {
      return { factor, weight, delta: 0, description: 'No legislator data for chamber' };
    }

    // Determine majority party in chamber
    const partyCounts: Record<string, number> = {};
    for (const leg of chamberLegislators) {
      const p = leg.party || 'Unknown';
      partyCounts[p] = (partyCounts[p] || 0) + 1;
    }
    const majorityParty = Object.entries(partyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Get author party — from author_ids or author_names lookup
    const authorParty = this.resolveAuthorParty(bill, legislators);

    if (!authorParty || !majorityParty) {
      return { factor, weight, delta: 0, description: 'Author party not determinable' };
    }

    const ALLIED_PARTIES: Record<string, string[]> = {
      PNP: ['PNP'],
      PPD: ['PPD', 'MVC'],
      MVC: ['PPD', 'MVC'],
    };

    if (authorParty === majorityParty) {
      return {
        factor, weight, delta: 20,
        description: `Author party (${authorParty}) holds majority in ${chamber || 'chamber'}`,
      };
    }

    const alliedWithMajority = (ALLIED_PARTIES[authorParty] || []).includes(majorityParty);
    if (alliedWithMajority) {
      return {
        factor, weight, delta: 10,
        description: `Author party (${authorParty}) allied with majority party (${majorityParty})`,
      };
    }

    return {
      factor, weight, delta: -10,
      description: `Author party (${authorParty}) is minority in ${chamber || 'chamber'}`,
    };
  }

  private resolveAuthorParty(bill: any, legislators: any[]): string | null {
    // Try author_ids first
    if (bill.author_ids && bill.author_ids.length > 0) {
      const leg = legislators.find((l: any) => l.id === bill.author_ids[0]);
      if (leg?.party) return leg.party;
    }
    // Try author_names
    if (bill.author_names && bill.author_names.length > 0) {
      const authorName: string = bill.author_names[0].toLowerCase();
      const leg = legislators.find((l: any) =>
        l.full_name?.toLowerCase().includes(authorName) ||
        authorName.includes(l.full_name?.toLowerCase() || '')
      );
      if (leg?.party) return leg.party;
    }
    // Try direct author field
    if (bill.author) {
      const authorName: string = bill.author.toLowerCase();
      const leg = legislators.find((l: any) =>
        l.full_name?.toLowerCase().includes(authorName)
      );
      if (leg?.party) return leg.party;
    }
    return null;
  }

  // ─── Factor 2: Committee chair approval history ──────────────────────────────
  // delta = 0 if < 5 historical bills (insufficient data)
  private scoreCommitteeChairHistory(
    bill: any,
    committees: any[],
    historicalBills: any[],
  ): ScoringFactor {
    const factor = 'committee_chair_history';
    const weight = 15;

    if (!bill || committees.length === 0 || historicalBills.length < 5) {
      return {
        factor, weight, delta: 0,
        description: historicalBills.length < 5
          ? `Insufficient historical data (${historicalBills.length} bills, need ≥5)`
          : 'No committee data available',
      };
    }

    // Find committee that handled this bill (by commission name match)
    const billCommission: string = bill.commission || bill.committee || '';
    const committee = committees.find(
      (c: any) =>
        c.name?.toLowerCase().includes(billCommission.toLowerCase()) ||
        billCommission.toLowerCase().includes(c.name?.toLowerCase() || '')
    );

    if (!committee) {
      return { factor, weight, delta: 0, description: 'Committee for bill not identified' };
    }

    // Approval rate of similar historical bills that went through same committee
    const committeeHistorical = historicalBills.filter(
      (hb: any) =>
        hb.commission?.toLowerCase().includes(committee.name?.toLowerCase()) ||
        committee.name?.toLowerCase().includes(hb.commission?.toLowerCase() || '')
    );

    if (committeeHistorical.length < 5) {
      return {
        factor, weight, delta: 0,
        description: `Insufficient committee-specific history (${committeeHistorical.length} bills)`,
      };
    }

    const approved = committeeHistorical.filter(
      (hb: any) => hb.status === 'approved' || hb.status === 'signed' || hb.status === 'enacted'
    ).length;
    const approvalRate = approved / committeeHistorical.length;
    const pct = Math.round(approvalRate * 100);

    if (approvalRate >= 0.6) {
      return { factor, weight, delta: 15, description: `Committee approval rate: ${pct}% (high)` };
    } else if (approvalRate >= 0.3) {
      return { factor, weight, delta: 5, description: `Committee approval rate: ${pct}% (moderate)` };
    } else {
      return { factor, weight, delta: -5, description: `Committee approval rate: ${pct}% (low)` };
    }
  }

  // ─── Factor 3: Bipartisan cosponsors ────────────────────────────────────────
  // +15 if cosponsors from ≥2 different parties
  // +8 if cosponsors from same party
  // 0 if no cosponsors
  private scoreBipartisanCosponsors(bill: any, legislators: any[]): ScoringFactor {
    const factor = 'bipartisan_cosponsors';
    const weight = 15;

    const cosponsors: string[] = bill.cosponsor_ids || bill.cosponsor_names || [];

    if (cosponsors.length === 0) {
      return { factor, weight, delta: 0, description: 'No cosponsors listed' };
    }

    // Resolve cosponsor parties
    const cosponsorParties = new Set<string>();
    for (const cs of cosponsors) {
      // Try by id
      let leg = legislators.find((l: any) => l.id === cs);
      if (!leg) {
        // Try by name
        leg = legislators.find(
          (l: any) => l.full_name?.toLowerCase().includes((cs as string).toLowerCase())
        );
      }
      if (leg?.party) cosponsorParties.add(leg.party);
    }

    if (cosponsorParties.size === 0) {
      return { factor, weight, delta: 8, description: `${cosponsors.length} cosponsor(s) (party not determinable — same-party assumed)` };
    }

    if (cosponsorParties.size >= 2) {
      return {
        factor, weight, delta: 15,
        description: `Bipartisan support: ${cosponsors.length} cosponsor(s) from ${cosponsorParties.size} parties (${Array.from(cosponsorParties).join(', ')})`,
      };
    }

    return {
      factor, weight, delta: 8,
      description: `${cosponsors.length} cosponsor(s) from same party (${Array.from(cosponsorParties)[0]})`,
    };
  }

  // ─── Factor 4: Session timing ────────────────────────────────────────────────
  // +10 if >90 days remaining
  // +5 if 30-90 days
  // -5 if <30 days
  // -10 if electoral year
  private scoreSessionTiming(sessionDaysRemaining: number, isElectoralYear: boolean): ScoringFactor {
    const factor = 'session_timing';
    const weight = 10;
    let delta = 0;
    let description = '';

    if (sessionDaysRemaining > 90) {
      delta += 10;
      description = `${sessionDaysRemaining} days remaining in session (ample time)`;
    } else if (sessionDaysRemaining >= 30) {
      delta += 5;
      description = `${sessionDaysRemaining} days remaining in session (moderate)`;
    } else {
      delta -= 5;
      description = `${sessionDaysRemaining} days remaining in session (critical — end of session)`;
    }

    if (isElectoralYear) {
      delta -= 10;
      description += '; electoral year — legislative output typically lower';
    }

    return { factor, weight, delta, description };
  }

  // ─── Factor 5: Fiscal note impact ────────────────────────────────────────────
  // +10 favorable, 0 neutral/missing, -15 unfavorable, -20 significant negative
  private scoreFiscalNote(fiscalNotes: any[]): ScoringFactor {
    const factor = 'fiscal_note';
    const weight = 15;

    if (!fiscalNotes || fiscalNotes.length === 0) {
      return { factor, weight, delta: 0, description: 'No fiscal note on record' };
    }

    // Use the most recent fiscal note
    const latest = fiscalNotes.sort((a, b) =>
      new Date(b.published_at || b.scraped_at || 0).getTime() -
      new Date(a.published_at || a.scraped_at || 0).getTime()
    )[0];

    const impactType: string = latest.fiscal_impact_type || 'undetermined';
    const impactAmount: number | null = latest.fiscal_impact_amount
      ? parseFloat(latest.fiscal_impact_amount)
      : null;

    if (impactType === 'saving' || impactType === 'favorable') {
      return { factor, weight, delta: 10, description: `Favorable fiscal note (${latest.source_agency || 'agency'})` };
    }

    if (impactType === 'cost') {
      // Significant negative if cost > $5M
      if (impactAmount !== null && impactAmount > 5_000_000) {
        return {
          factor, weight, delta: -20,
          description: `Significant fiscal cost: $${(impactAmount / 1_000_000).toFixed(1)}M (${latest.source_agency || 'agency'})`,
        };
      }
      return { factor, weight, delta: -15, description: `Unfavorable fiscal note — cost identified (${latest.source_agency || 'agency'})` };
    }

    return { factor, weight, delta: 0, description: `Neutral or undetermined fiscal impact (${impactType})` };
  }

  // ─── Factor 6: FOMB compliance status ────────────────────────────────────────
  // +5 compliant, 0 no action, -10 active review, -15 blocked
  private scoreFombStatus(fombActions: any[]): ScoringFactor {
    const factor = 'fomb_status';
    const weight = 15;

    if (!fombActions || fombActions.length === 0) {
      return { factor, weight, delta: 0, description: 'No FOMB action on record' };
    }

    // Find most critical action
    const hasBlocked = fombActions.some((a: any) => a.implementation_status === 'blocked');
    const hasActiveReview = fombActions.some(
      (a: any) => a.implementation_status === 'under_review' || a.action_type === 'objection'
    );
    const hasCompliant = fombActions.some(
      (a: any) => a.implementation_status === 'compliant' || a.action_type === 'certification'
    );

    if (hasBlocked) {
      return { factor, weight, delta: -15, description: 'FOMB has issued blocking action on this bill' };
    }
    if (hasActiveReview) {
      return { factor, weight, delta: -10, description: 'Bill under active FOMB review' };
    }
    if (hasCompliant) {
      return { factor, weight, delta: 5, description: 'FOMB certification or compliance confirmed' };
    }

    return { factor, weight, delta: 0, description: 'FOMB action on record — no explicit block or approval' };
  }

  // ─── Factor 7: Thematic approval rate ────────────────────────────────────────
  // >50% approval rate: +5, 20-50%: +2, <20%: -3
  // < 5 historical bills: delta = 0
  private scoreThematicApprovalRate(historicalBills: any[]): ScoringFactor {
    const factor = 'thematic_approval_rate';
    const weight = 10;

    if (!historicalBills || historicalBills.length < 5) {
      return {
        factor, weight, delta: 0,
        description: `Insufficient historical data (${historicalBills?.length || 0} bills, need ≥5)`,
      };
    }

    const approved = historicalBills.filter(
      (hb: any) => hb.status === 'approved' || hb.status === 'signed' || hb.status === 'enacted'
    ).length;
    const rate = approved / historicalBills.length;
    const pct = Math.round(rate * 100);

    if (rate > 0.5) {
      return { factor, weight, delta: 5, description: `Thematic approval rate: ${pct}% (${approved}/${historicalBills.length} similar bills approved)` };
    } else if (rate >= 0.2) {
      return { factor, weight, delta: 2, description: `Thematic approval rate: ${pct}% (${approved}/${historicalBills.length} similar bills approved)` };
    } else {
      return { factor, weight, delta: -3, description: `Thematic approval rate: ${pct}% (${approved}/${historicalBills.length} similar bills approved — low)` };
    }
  }

  // ─── Confidence ──────────────────────────────────────────────────────────────
  // high if ≥6 factors had data, medium if 4-5, low if <4
  private calculateConfidence(factorsWithData: number): 'low' | 'medium' | 'high' {
    if (factorsWithData >= 6) return 'high';
    if (factorsWithData >= 4) return 'medium';
    return 'low';
  }
}
