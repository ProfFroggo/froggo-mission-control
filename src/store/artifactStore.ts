import { create } from 'zustand';

// ---- Array Bounds ---------------------------------------------------------
const MAX_ARTIFACTS = 100;
const MAX_VERSIONS_PER_ARTIFACT = 10;
// ---------------------------------------------------------------------------

export type ArtifactType = 'code' | 'image' | 'file' | 'text' | 'diagram' | 'data';

export interface ArtifactMetadata {
  language?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  encoding?: string;
  [key: string]: any;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  timestamp: number;
  messageId: string;
  changeDescription?: string;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  messageId: string;
  sessionId?: string;
  timestamp: number;
  metadata?: ArtifactMetadata;
  versions: ArtifactVersion[];
  currentVersion: number;
  tags?: string[];
}

interface ArtifactState {
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  isCollapsed: boolean;
  filterBySession: string | null;
  searchQuery: string;

  // Actions
  addArtifact: (artifact: Omit<Artifact, 'id' | 'versions' | 'currentVersion'>) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  deleteArtifact: (id: string) => void;
  clearArtifacts: () => void;
  clearSessionArtifacts: (sessionId: string) => void;

  // Version management
  addVersion: (artifactId: string, content: string, messageId: string, changeDescription?: string) => void;
  revertToVersion: (artifactId: string, version: number) => void;
  getVersionHistory: (artifactId: string) => ArtifactVersion[];

  // Selection and UI state
  selectArtifact: (id: string | null) => void;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setFilterBySession: (sessionId: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Getters
  getArtifact: (id: string) => Artifact | undefined;
  getSessionArtifacts: (sessionId: string) => Artifact[];
  getFilteredArtifacts: () => Artifact[];
}

export const useArtifactStore = create<ArtifactState>()(
  (set, get) => ({
    artifacts: [],
    selectedArtifactId: null,
    isCollapsed: false,
    filterBySession: null,
    searchQuery: '',

    addArtifact: (artifact) => {
      const id = `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newArtifact: Artifact = {
        ...artifact,
        id,
        versions: [
          {
            version: 1,
            content: artifact.content,
            timestamp: artifact.timestamp,
            messageId: artifact.messageId,
          },
        ],
        currentVersion: 1,
      };

      set((state) => ({
        artifacts: [...state.artifacts, newArtifact].slice(-MAX_ARTIFACTS),
        // Auto-select if this is the first artifact or panel is not collapsed
        selectedArtifactId: state.artifacts.length === 0 || !state.isCollapsed
          ? id
          : state.selectedArtifactId,
      }));
    },

    updateArtifact: (id, updates) => {
      set((state) => ({
        artifacts: state.artifacts.map((artifact) =>
          artifact.id === id ? { ...artifact, ...updates } : artifact
        ),
      }));
    },

    deleteArtifact: (id) => {
      set((state) => ({
        artifacts: state.artifacts.filter((a) => a.id !== id),
        selectedArtifactId:
          state.selectedArtifactId === id ? null : state.selectedArtifactId,
      }));
    },

    clearArtifacts: () => {
      set({ artifacts: [], selectedArtifactId: null });
    },

    clearSessionArtifacts: (sessionId) => {
      set((state) => {
        const newArtifacts = state.artifacts.filter(
          (a) => a.sessionId !== sessionId
        );
        return {
          artifacts: newArtifacts,
          selectedArtifactId:
            state.artifacts.find((a) => a.id === state.selectedArtifactId)?.sessionId === sessionId
              ? null
              : state.selectedArtifactId,
        };
      });
    },

    addVersion: (artifactId, content, messageId, changeDescription) => {
      set((state) => ({
        artifacts: state.artifacts.map((artifact) => {
          if (artifact.id === artifactId) {
            const newVersion = artifact.currentVersion + 1;
            return {
              ...artifact,
              content,
              versions: [
                ...artifact.versions,
                {
                  version: newVersion,
                  content,
                  timestamp: Date.now(),
                  messageId,
                  changeDescription,
                },
              ].slice(-MAX_VERSIONS_PER_ARTIFACT),
              currentVersion: newVersion,
            };
          }
          return artifact;
        }),
      }));
    },

    revertToVersion: (artifactId, version) => {
      set((state) => ({
        artifacts: state.artifacts.map((artifact) => {
          if (artifact.id === artifactId) {
            const targetVersion = artifact.versions.find((v) => v.version === version);
            if (targetVersion) {
              return {
                ...artifact,
                content: targetVersion.content,
                currentVersion: version,
              };
            }
          }
          return artifact;
        }),
      }));
    },

    getVersionHistory: (artifactId) => {
      const artifact = get().artifacts.find((a) => a.id === artifactId);
      return artifact?.versions || [];
    },

    selectArtifact: (id) => {
      set({ selectedArtifactId: id });
    },

    toggleCollapse: () => {
      set((state) => ({ isCollapsed: !state.isCollapsed }));
    },

    setCollapsed: (collapsed) => {
      set({ isCollapsed: collapsed });
    },

    setFilterBySession: (sessionId) => {
      set({ filterBySession: sessionId });
    },

    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    getArtifact: (id) => {
      return get().artifacts.find((a) => a.id === id);
    },

    getSessionArtifacts: (sessionId) => {
      return get().artifacts.filter((a) => a.sessionId === sessionId);
    },

    getFilteredArtifacts: () => {
      const { artifacts, filterBySession, searchQuery } = get();
      let filtered = artifacts;

      // Filter by session
      if (filterBySession) {
        filtered = filtered.filter((a) => a.sessionId === filterBySession);
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.content.toLowerCase().includes(query) ||
            a.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      // Sort by timestamp (newest first)
      return filtered.sort((a, b) => b.timestamp - a.timestamp);
    },
  })
);
