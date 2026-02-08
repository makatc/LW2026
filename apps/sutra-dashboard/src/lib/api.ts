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

    return response.json();
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
