const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Only redirect if valid token was sent but rejected
        // Avoid loop if endpoint is public but returns 401
        // (Though public endpoints shouldn't return 401)
        if (typeof window !== 'undefined' && token) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        // Try to parse error message
        let errMsg = response.statusText;
        try {
            const errData = await response.json();
            if (errData.message) errMsg = errData.message;
        } catch (e) { }
        throw new Error(errMsg);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function updatePassword(currentPassword: string, newPassword: string) {
    return fetchWithAuth('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}

// Summary
export async function fetchDashboardSummary() {
    return fetchWithAuth('/dashboard/summary');
}

// User Management (Admin)
export async function fetchUsers() {
    return fetchWithAuth('/auth/users');
}

export async function createUser(data: any) {
    return fetchWithAuth('/auth/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function deleteUser(id: string) {
    return fetchWithAuth(`/auth/users/${id}`, {
        method: 'DELETE',
    });
}

export async function updateUser(id: string, data: any) {
    return fetchWithAuth(`/auth/users/${id}`, {
        method: 'POST', // Using POST as defined in controller
        body: JSON.stringify(data),
    });
}

// Keywords
export async function fetchConfigKeywords() {
    return fetchWithAuth('/config/keywords');
}

export async function addKeyword(keyword: string) {
    return fetchWithAuth('/config/keywords', {
        method: 'POST',
        body: JSON.stringify({ keyword }),
    });
}

export async function deleteKeyword(id: string) {
    return fetchWithAuth(`/config/keywords/${id}`, {
        method: 'DELETE',
    });
}

// Phrases
export async function fetchPhrases() {
    return fetchWithAuth('/config/phrases');
}

export async function addPhrase(phrase: string) {
    return fetchWithAuth('/config/phrases', {
        method: 'POST',
        body: JSON.stringify({ phrase }),
    });
}

export async function deletePhrase(id: string) {
    return fetchWithAuth(`/config/phrases/${id}`, {
        method: 'DELETE',
    });
}

// Commissions
export async function fetchAllCommissions() {
    return fetchWithAuth('/config/commissions/all');
}

export async function fetchFollowedCommissions() {
    return fetchWithAuth('/config/commissions/followed');
}

export async function followCommission(commissionId: string) {
    return fetchWithAuth('/config/commissions/follow', {
        method: 'POST',
        body: JSON.stringify({ commissionId }),
    });
}

export async function unfollowCommission(commissionId: string) {
    return fetchWithAuth(`/config/commissions/follow/${commissionId}`, {
        method: 'DELETE',
    });
}

// Watchlist
export async function fetchWatchlist() {
    return fetchWithAuth('/config/watchlist');
}

export async function addToWatchlistByNumber(number: string) {
    return fetchWithAuth('/config/watchlist/by-number', {
        method: 'POST',
        body: JSON.stringify({ number }),
    });
}

export async function removeFromWatchlist(id: string) {
    return fetchWithAuth(`/config/watchlist/${id}`, {
        method: 'DELETE',
    });
}

// Webhooks
export async function fetchWebhooks() {
    return fetchWithAuth('/config/webhooks');
}

export async function updateWebhooks(data: { alertsUrl: string, updatesUrl: string }) {
    return fetchWithAuth('/config/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchEmailPreferences() {
    return fetchWithAuth('/config/email-preferences');
}

export async function updateEmailPreferences(data: { enabled: boolean, frequency: 'daily' | 'weekly' }) {
    return fetchWithAuth('/config/email-preferences', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// Measures
export async function fetchMeasures(params?: { limit?: number; page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.page) searchParams.append('page', params.page.toString());

    const queryString = searchParams.toString();
    return fetchWithAuth(`/measures${queryString ? `?${queryString}` : ''}`);
}

// Dashboard - Findings (Keywords + Topics hits)
export async function fetchFindings(params?: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    return fetchWithAuth(`/dashboard/findings${queryString ? `?${queryString}` : ''}`);
}

// Dashboard - Watchlist items with recent updates
export async function fetchWatchlistItems(params?: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    return fetchWithAuth(`/dashboard/watchlist${queryString ? `?${queryString}` : ''}`);
}

// Dashboard - Commission notifications
export async function fetchCommissionNotifications(params?: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    return fetchWithAuth(`/dashboard/commissions${queryString ? `?${queryString}` : ''}`);
}

// Add measure to watchlist by ID
export async function addMeasureToWatchlist(measureId: string) {
    return fetchWithAuth('/config/watchlist', {
        method: 'POST',
        body: JSON.stringify({ measureId }),
    });
}

// ─── New: Legislators ────────────────────────────────────────────────────────

export async function fetchLegislators(params?: { chamber?: string; party?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.chamber) searchParams.append('chamber', params.chamber);
    if (params?.party) searchParams.append('party', params.party);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/legislators${qs ? `?${qs}` : ''}`);
}

export async function fetchLegislator(id: string) {
    return fetchWithAuth(`/api/legislators/${id}`);
}

export async function fetchLegislatorsSummary() {
    return fetchWithAuth('/api/legislators/summary');
}

// ─── New: Committees ─────────────────────────────────────────────────────────

export async function fetchCommitteesNew(params?: { chamber?: string; type?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.chamber) searchParams.append('chamber', params.chamber);
    if (params?.type) searchParams.append('type', params.type);
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/committees${qs ? `?${qs}` : ''}`);
}

export async function fetchCommitteeDetail(id: string) {
    return fetchWithAuth(`/api/committees/${id}`);
}

// ─── New: Bills (Enhanced) ───────────────────────────────────────────────────

export async function fetchBillsEnhanced(params?: {
    bill_type?: string;
    status?: string;
    commission?: string;
    author?: string;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const searchParams = new URLSearchParams();
    if (params?.bill_type) searchParams.append('bill_type', params.bill_type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.commission) searchParams.append('commission', params.commission);
    if (params?.author) searchParams.append('author', params.author);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) searchParams.append('offset', params.offset.toString());
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/bills${qs ? `?${qs}` : ''}`);
}

export async function fetchBillDetail(id: string) {
    return fetchWithAuth(`/api/bills/${id}`);
}

export async function fetchBillsSummary() {
    return fetchWithAuth('/api/bills/summary');
}

// ─── New: Votes ──────────────────────────────────────────────────────────────

export async function fetchVotes(billId: string) {
    return fetchWithAuth(`/api/votes/${billId}`);
}

export async function fetchRecentVotes(limit?: number) {
    return fetchWithAuth(`/api/votes/recent${limit ? `?limit=${limit}` : ''}`);
}

// ─── New: Scraper Admin ──────────────────────────────────────────────────────

export async function triggerScraper(scraper: string) {
    return fetchWithAuth('/api/scraper/trigger', {
        method: 'POST',
        body: JSON.stringify({ scraper }),
    });
}

export async function getScraperStatus() {
    return fetchWithAuth('/api/scraper/status');
}

// ─── Legislators: Extended ───────────────────────────────────────────────────

export async function fetchLegislatorStaff(legislatorId: string) {
    return fetchWithAuth(`/api/legislators/${legislatorId}/staff`);
}

export async function createLegislatorStaff(legislatorId: string, data: { name: string; title: string; email?: string }) {
    return fetchWithAuth(`/api/legislators/${legislatorId}/staff`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchLegislatorCommittees(legislatorId: string) {
    return fetchWithAuth(`/api/legislators/${legislatorId}/committees`);
}

export async function fetchLegislatorInteractions(legislatorId: string, params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/legislators/${legislatorId}/interactions${qs ? `?${qs}` : ''}`);
}

export async function fetchLegislatorIntelligence(legislatorId: string) {
    return fetchWithAuth(`/api/legislators/${legislatorId}/intelligence-profile`);
}

export async function fetchLegislatorPositions(legislatorId: string) {
    return fetchWithAuth(`/api/legislators/${legislatorId}/positions`);
}

export async function createLegislator(data: {
    full_name: string; chamber: string; party?: string; district?: string;
    email?: string; phone?: string; office?: string; photo_url?: string;
}) {
    return fetchWithAuth('/api/legislators', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateLegislator(id: string, data: Record<string, any>) {
    return fetchWithAuth(`/api/legislators/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function updateLegislatorPrivateMetadata(id: string, data: Record<string, any>) {
    return fetchWithAuth(`/api/legislators/${id}/private-metadata`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

// ─── Interactions ────────────────────────────────────────────────────────────

export async function fetchInteractions(params?: {
    legislator_id?: string;
    date_from?: string;
    date_to?: string;
    contact_type?: string;
    limit?: number;
    offset?: number;
}) {
    const searchParams = new URLSearchParams();
    if (params?.legislator_id) searchParams.append('legislator_id', params.legislator_id);
    if (params?.date_from) searchParams.append('date_from', params.date_from);
    if (params?.date_to) searchParams.append('date_to', params.date_to);
    if (params?.contact_type) searchParams.append('contact_type', params.contact_type);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/interactions${qs ? `?${qs}` : ''}`);
}

export async function fetchInteraction(id: string) {
    return fetchWithAuth(`/api/interactions/${id}`);
}

export async function createInteraction(data: {
    legislator_id: string;
    contact_type: string;
    interaction_date: string;
    notes?: string;
    next_step_description?: string;
    next_step_date?: string;
    participants?: Array<{ staff_id?: string; legislator_id: string; custom_name?: string }>;
    measures?: Array<{ measure_id?: string; measure_reference?: string; position_expressed?: string }>;
}) {
    return fetchWithAuth('/api/interactions', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateInteraction(id: string, data: Record<string, any>) {
    return fetchWithAuth(`/api/interactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteInteraction(id: string) {
    return fetchWithAuth(`/api/interactions/${id}`, {
        method: 'DELETE',
    });
}

export async function uploadInteractionAttachment(interactionId: string, file: File) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/api/interactions/${interactionId}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(err.message || 'Upload failed');
    }

    return response.json();
}

export async function deleteInteractionAttachment(interactionId: string, attachmentId: string) {
    return fetchWithAuth(`/api/interactions/${interactionId}/attachments/${attachmentId}`, {
        method: 'DELETE',
    });
}

// ─── Measures Search (for interaction panel autocomplete) ────────────────────

export async function searchMeasures(query: string) {
    const searchParams = new URLSearchParams({ search: query, limit: '20' });
    return fetchWithAuth(`/api/bills?${searchParams.toString()}`);
}

// ─── Intelligence (Phase 2: AI) ─────────────────────────────────────────────

export async function ingestLegislatorData(legislatorId: string) {
    return fetchWithAuth(`/api/intelligence/legislators/${legislatorId}/ingest`, {
        method: 'POST',
    });
}

export async function generateLegislatorProfile(legislatorId: string) {
    return fetchWithAuth(`/api/intelligence/legislators/${legislatorId}/generate-profile`, {
        method: 'POST',
    });
}

export async function predictLegislatorPosition(legislatorId: string, measureId: string) {
    return fetchWithAuth(`/api/intelligence/legislators/${legislatorId}/predict-position/${measureId}`);
}

export async function fetchHistoricalData(legislatorId: string) {
    return fetchWithAuth(`/api/intelligence/legislators/${legislatorId}/historical-data`);
}

// ─── Compliance (Phase 5) ───────────────────────────────────────────────────

export async function fetchComplianceReport(year?: number, semester?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', year.toString());
    if (semester) params.set('semester', semester.toString());
    return fetchWithAuth(`/api/compliance/report?${params.toString()}`);
}

export async function fetchComplianceSummary(year?: number, semester?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', year.toString());
    if (semester) params.set('semester', semester.toString());
    return fetchWithAuth(`/api/compliance/summary?${params.toString()}`);
}

export function getCompliancePdfUrl(year?: number, semester?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', year.toString());
    if (semester) params.set('semester', semester.toString());
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${base}/api/compliance/report/pdf?${params.toString()}`;
}

// ─── DOJ Registry (Phase 6) ────────────────────────────────────────────────

export async function scrapeDojRegistry() {
    return fetchWithAuth('/api/doj-registry/scrape', { method: 'POST' });
}

export async function fetchDojLobbyists(search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchWithAuth(`/api/doj-registry/lobbyists${params}`);
}

export async function fetchDojLobbyistsForLegislator(legislatorName: string) {
    return fetchWithAuth(`/api/doj-registry/lobbyists-for-legislator?legislator_name=${encodeURIComponent(legislatorName)}`);
}

export async function fetchDojLastScrape() {
    return fetchWithAuth('/api/doj-registry/last-scrape');
}
