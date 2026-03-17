const RAG_API = process.env.NEXT_PUBLIC_RAG_API_URL ?? 'http://localhost:3004/api';
const MONITOR_API = process.env.NEXT_PUBLIC_MONITOR_API_URL ?? 'http://localhost:3001/api';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// Projects
export const getProjects = () => fetchApi<import('@/context/DossierContext').DossierProject[]>(`${RAG_API}/projects`);
export const createProject = (data: { name: string; description?: string; measure_reference?: string }) =>
  fetchApi<import('@/context/DossierContext').DossierProject>(`${RAG_API}/projects`, { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: { name?: string; description?: string; measure_reference?: string }) =>
  fetchApi(`${RAG_API}/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  fetch(`${RAG_API}/projects/${id}`, { method: 'DELETE' });

// Documents
export const getDocuments = (projectId: string) =>
  fetchApi<import('@/context/DossierContext').DossierDocument[]>(`${RAG_API}/projects/${projectId}/documents`);
export const getDocumentStatus = (projectId: string, docId: string) =>
  fetchApi<import('@/context/DossierContext').DossierDocument>(`${RAG_API}/projects/${projectId}/documents/${docId}/status`);
export const deleteDocument = (projectId: string, docId: string) =>
  fetch(`${RAG_API}/projects/${projectId}/documents/${docId}`, { method: 'DELETE' });

export async function uploadDocument(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${RAG_API}/projects/${projectId}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Conversations
export const getConversations = (projectId: string) =>
  fetchApi<import('@/context/DossierContext').DossierConversation[]>(`${RAG_API}/projects/${projectId}/conversations`);
export const createConversation = (projectId: string, title?: string) =>
  fetchApi<import('@/context/DossierContext').DossierConversation>(`${RAG_API}/projects/${projectId}/conversations`, {
    method: 'POST', body: JSON.stringify({ title }),
  });
export const getMessages = (conversationId: string) =>
  fetchApi<import('@/context/DossierContext').DossierMessage[]>(`${RAG_API}/conversations/${conversationId}/messages`);
export const sendMessage = (conversationId: string, content: string) =>
  fetchApi<import('@/context/DossierContext').DossierMessage>(`${RAG_API}/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({ content }),
  });

// Transformations
export const createTransformation = (data: {
  project_id: string;
  transformation_type: string;
  title: string;
  legislator_id?: string;
  client_stance: string;
  tone_profile?: string;
  selected_chunk_ids: string[];
  custom_instructions?: string;
}) => fetchApi<import('@/context/DossierContext').DossierTransformation>(`${RAG_API}/transformations`, {
  method: 'POST', body: JSON.stringify(data),
});
export const getTransformation = (id: string) =>
  fetchApi<import('@/context/DossierContext').DossierTransformation>(`${RAG_API}/transformations/${id}`);
export const getProjectTransformations = (projectId: string) =>
  fetchApi<import('@/context/DossierContext').DossierTransformation[]>(`${RAG_API}/projects/${projectId}/transformations`);
export const updateTransformation = (id: string, content: string) =>
  fetchApi<import('@/context/DossierContext').DossierTransformation>(`${RAG_API}/transformations/${id}`, {
    method: 'PATCH', body: JSON.stringify({ content }),
  });

// Legislators (from sutra-monitor)
export const searchLegislators = (search: string) =>
  fetchApi<Array<{ id: string; full_name: string; party?: string; chamber: string }>>(`${MONITOR_API}/legislators?search=${encodeURIComponent(search)}&limit=10`);
