'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface DossierProject {
  id: string;
  name: string;
  description?: string;
  measure_reference?: string;
  documents?: DossierDocument[];
  conversations?: DossierConversation[];
  transformations?: DossierTransformation[];
  created_at: string;
  updated_at: string;
}

export interface DossierDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'error';
  processing_error?: string;
  chunk_count: number;
  uploaded_at: string;
  processed_at?: string;
}

export interface DossierConversation {
  id: string;
  project_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface DossierTransformation {
  id: string;
  project_id: string;
  transformation_type: string;
  title: string;
  generation_status: 'pending' | 'generating' | 'completed' | 'error';
  generated_content?: string;
  created_at: string;
}

export interface MessageCitation {
  chunk_id: string;
  document_name: string;
  section_reference?: string;
  page_number?: number;
}

export interface DossierMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: MessageCitation[];
  created_at: string;
}

interface DossierContextValue {
  activeProject: DossierProject | null;
  setActiveProject: (p: DossierProject | null) => void;
  activeConversation: DossierConversation | null;
  setActiveConversation: (c: DossierConversation | null) => void;
  selectedChunkIds: string[];
  addChunkId: (id: string) => void;
  removeChunkId: (id: string) => void;
  clearChunks: () => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (v: boolean) => void;
  selectionMode: boolean;
  setSelectionMode: (v: boolean) => void;
  activeTransformation: DossierTransformation | null;
  setActiveTransformation: (t: DossierTransformation | null) => void;
}

const DossierContext = createContext<DossierContextValue | null>(null);

export function DossierProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProject] = useState<DossierProject | null>(null);
  const [activeConversation, setActiveConversation] = useState<DossierConversation | null>(null);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeTransformation, setActiveTransformation] = useState<DossierTransformation | null>(null);

  const addChunkId = useCallback((id: string) => {
    setSelectedChunkIds((prev) => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const removeChunkId = useCallback((id: string) => {
    setSelectedChunkIds((prev) => prev.filter((c) => c !== id));
  }, []);

  const clearChunks = useCallback(() => setSelectedChunkIds([]), []);

  return (
    <DossierContext.Provider value={{
      activeProject, setActiveProject,
      activeConversation, setActiveConversation,
      selectedChunkIds, addChunkId, removeChunkId, clearChunks,
      rightPanelOpen, setRightPanelOpen,
      selectionMode, setSelectionMode,
      activeTransformation, setActiveTransformation,
    }}>
      {children}
    </DossierContext.Provider>
  );
}

export function useDossier(): DossierContextValue {
  const ctx = useContext(DossierContext);
  if (!ctx) throw new Error('useDossier must be used inside DossierProvider');
  return ctx;
}
