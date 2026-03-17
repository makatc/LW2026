const MONITOR_URL = process.env.NEXT_PUBLIC_API_URL || '/api/monitor';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

async function apiFetch(endpoint: string, options: RequestInit = {}, token?: string): Promise<any> {
  const tok = token || getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const response = await fetch(`${MONITOR_URL}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    if (typeof window !== 'undefined' && tok) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData.message) errMsg = errData.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ─── AI Summaries ─────────────────────────────────────────────────────────────

export async function generateSummary(
  billId: string,
  summaryType: 'executive' | 'technical_legal' | 'tweet',
  token: string
): Promise<any> {
  return apiFetch(`/api/ai-summaries/bills/${billId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ summary_type: summaryType }),
  }, token);
}

export async function getSummaries(billId: string, token: string): Promise<any[]> {
  return apiFetch(`/api/ai-summaries/bills/${billId}`, {}, token);
}

export async function getAudioBriefingToday(token: string): Promise<any> {
  return apiFetch('/api/ai-summaries/audio-briefing/today', {}, token);
}

// ─── Executive Radar ──────────────────────────────────────────────────────────

export async function getExecutiveOrders(
  filters: { sector?: string; year?: number; page?: number },
  token?: string
): Promise<{ data: any[]; total: number }> {
  const qs = new URLSearchParams();
  if (filters.sector) qs.set('sector', filters.sector);
  if (filters.year) qs.set('year', String(filters.year));
  if (filters.page) qs.set('page', String(filters.page));
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/api/executive-orders${query}`, {}, token);
}

export async function getExecutiveOrderById(id: string, token?: string): Promise<any> {
  return apiFetch(`/api/executive-orders/${id}`, {}, token);
}

export async function getUserAlerts(token: string): Promise<any[]> {
  return apiFetch('/api/executive-orders/alerts', {}, token);
}

export async function dismissAlert(alertId: string, token: string): Promise<void> {
  return apiFetch(`/api/executive-orders/alerts/${alertId}/dismiss`, { method: 'POST' }, token);
}

// ─── Coalitions ───────────────────────────────────────────────────────────────

export async function getCoalitions(token: string): Promise<any[]> {
  return apiFetch('/api/coalitions', {}, token);
}

export async function createCoalition(data: { name: string; bill_id: string }, token: string): Promise<any> {
  return apiFetch('/api/coalitions', { method: 'POST', body: JSON.stringify(data) }, token);
}

export async function getCoalitionById(id: string, token: string): Promise<any> {
  return apiFetch(`/api/coalitions/${id}`, {}, token);
}

export async function updateCoalition(id: string, data: any, token: string): Promise<any> {
  return apiFetch(`/api/coalitions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export async function deleteCoalition(id: string, token: string): Promise<void> {
  return apiFetch(`/api/coalitions/${id}`, { method: 'DELETE' }, token);
}

export async function addCoalitionMember(coalitionId: string, data: any, token: string): Promise<any> {
  return apiFetch(`/api/coalitions/${coalitionId}/members`, { method: 'POST', body: JSON.stringify(data) }, token);
}

export async function updateCoalitionMember(
  coalitionId: string,
  memberId: string,
  data: any,
  token: string
): Promise<any> {
  return apiFetch(`/api/coalitions/${coalitionId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export async function removeCoalitionMember(
  coalitionId: string,
  memberId: string,
  token: string
): Promise<void> {
  return apiFetch(`/api/coalitions/${coalitionId}/members/${memberId}`, { method: 'DELETE' }, token);
}

export async function addCommitment(coalitionId: string, data: any, token: string): Promise<any> {
  return apiFetch(`/api/coalitions/${coalitionId}/commitments`, { method: 'POST', body: JSON.stringify(data) }, token);
}

export async function updateCommitment(
  coalitionId: string,
  commitmentId: string,
  data: any,
  token: string
): Promise<any> {
  return apiFetch(`/api/coalitions/${coalitionId}/commitments/${commitmentId}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export async function addMessage(
  coalitionId: string,
  data: { content: string; message_type: string },
  token: string
): Promise<any> {
  return apiFetch(`/api/coalitions/${coalitionId}/messages`, { method: 'POST', body: JSON.stringify(data) }, token);
}

export async function getMessages(coalitionId: string, token: string): Promise<any[]> {
  return apiFetch(`/api/coalitions/${coalitionId}/messages`, {}, token);
}

export async function searchLobbyists(query: string, sector?: string): Promise<any[]> {
  const qs = new URLSearchParams({ search: query });
  if (sector) qs.set('sector', sector);
  return apiFetch(`/api/doj-registry/lobbyists?${qs}`);
}

// ─── Predictive Analysis ──────────────────────────────────────────────────────

export async function getViabilityScore(billId: string, token: string): Promise<any> {
  return apiFetch(`/api/predictive/bills/${billId}/viability`, {}, token);
}

export async function recalculateScore(billId: string, token: string): Promise<any> {
  return apiFetch(`/api/predictive/bills/${billId}/recalculate`, { method: 'POST' }, token);
}

export async function getPortfolioOverview(token: string): Promise<any[]> {
  return apiFetch('/api/predictive/portfolio', {}, token);
}

// ─── Contract Analyzer ────────────────────────────────────────────────────────

export async function uploadContractForAnalysis(
  file: File,
  token: string
): Promise<{ analysisId: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${MONITOR_URL}/api/contracts/analyze`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || 'Upload failed');
  }

  return response.json();
}

export async function getAnalysisStatus(id: string, token: string): Promise<any> {
  return apiFetch(`/api/contracts/${id}/status`, {}, token);
}

export async function getContractReport(id: string, token: string): Promise<any> {
  return apiFetch(`/api/contracts/${id}/report`, {}, token);
}

export async function getUserContractAnalyses(token: string): Promise<any[]> {
  return apiFetch('/api/contracts', {}, token);
}

export async function deleteContractAnalysis(id: string, token: string): Promise<void> {
  return apiFetch(`/api/contracts/${id}`, { method: 'DELETE' }, token);
}
