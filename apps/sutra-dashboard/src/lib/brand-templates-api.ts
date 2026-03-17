const MONITOR_URL = process.env.NEXT_PUBLIC_MONITOR_URL || 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  header_image_url?: string;
  header_html?: string;
  footer_html?: string;
  footer_image_url?: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_position: 'left' | 'center' | 'right';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${MONITOR_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    let msg = response.statusText;
    try {
      const err = await response.json();
      if (err.message) msg = err.message;
    } catch (_) {}
    throw new Error(msg);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getBrandTemplates(token: string): Promise<BrandTemplate[]> {
  return apiFetch<BrandTemplate[]>(token, '/api/brand-templates');
}

export async function getBrandTemplate(token: string, id: string): Promise<BrandTemplate> {
  return apiFetch<BrandTemplate>(token, `/api/brand-templates/${id}`);
}

export async function createBrandTemplate(
  token: string,
  data: Partial<BrandTemplate>,
): Promise<BrandTemplate> {
  return apiFetch<BrandTemplate>(token, '/api/brand-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBrandTemplate(
  token: string,
  id: string,
  data: Partial<BrandTemplate>,
): Promise<BrandTemplate> {
  return apiFetch<BrandTemplate>(token, `/api/brand-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBrandTemplate(token: string, id: string): Promise<void> {
  await apiFetch<void>(token, `/api/brand-templates/${id}`, { method: 'DELETE' });
}

export async function setDefaultTemplate(token: string, id: string): Promise<BrandTemplate> {
  return apiFetch<BrandTemplate>(token, `/api/brand-templates/${id}/set-default`, {
    method: 'POST',
  });
}

export async function uploadLogo(token: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${MONITOR_URL}/api/brand-templates/upload-logo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type here — browser sets it with boundary for multipart
    },
    body: formData,
  });

  if (!response.ok) {
    let msg = response.statusText;
    try {
      const err = await response.json();
      if (err.message) msg = err.message;
    } catch (_) {}
    throw new Error(msg);
  }

  return response.json();
}
