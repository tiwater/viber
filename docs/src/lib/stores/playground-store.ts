/**
 * Playground Space Store
 * localStorage-backed Space implementation for the playground demo
 */

import { writable, get } from 'svelte/store';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Artifact {
  id: string;
  name: string;
  content: string;
  type: 'markdown' | 'code' | 'text';
  createdAt: number;
}

export interface PlaygroundSpace {
  messages: Message[];
  artifacts: Artifact[];
  streamingContent: string; // Current streaming message content
  isStreaming: boolean;
  config: {
    model: string;
    agentName: string;
  };
}

const SPACE_KEY = 'viber-playground-space';

function createDefaultSpace(): PlaygroundSpace {
  return {
    messages: [],
    artifacts: [],
    streamingContent: '',
    isStreaming: false,
    config: {
      model: 'anthropic/claude-sonnet-4',
      agentName: 'Assistant',
    },
  };
}

function loadFromStorage(): PlaygroundSpace {
  if (typeof window === 'undefined') return createDefaultSpace();

  try {
    const stored = localStorage.getItem(SPACE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure new fields exist
      return {
        ...createDefaultSpace(),
        ...parsed,
        streamingContent: '',
        isStreaming: false,
      };
    }
  } catch (e) {
    console.warn('Failed to load space from localStorage:', e);
  }
  return createDefaultSpace();
}

function saveToStorage(space: PlaygroundSpace) {
  if (typeof window === 'undefined') return;

  try {
    // Don't persist streaming state
    const { streamingContent, isStreaming, ...persistable } = space;
    localStorage.setItem(SPACE_KEY, JSON.stringify(persistable));
  } catch (e) {
    console.warn('Failed to save space to localStorage:', e);
  }
}

function createPlaygroundStore() {
  const { subscribe, set, update } = writable<PlaygroundSpace>(createDefaultSpace());

  return {
    subscribe,

    // Initialize from localStorage (call on mount)
    init() {
      const space = loadFromStorage();
      set(space);
    },

    // Add a message
    addMessage(role: Message['role'], content: string) {
      update(space => {
        const newMessage: Message = {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: Date.now(),
        };
        const updated = {
          ...space,
          messages: [...space.messages, newMessage],
        };
        saveToStorage(updated);
        return updated;
      });
    },

    // Start streaming a new assistant message
    startStreaming() {
      update(space => ({
        ...space,
        streamingContent: '',
        isStreaming: true,
      }));
    },

    // Append content to the streaming message
    appendStreamingContent(chunk: string) {
      update(space => ({
        ...space,
        streamingContent: space.streamingContent + chunk,
      }));
    },

    // Finish streaming and save the message
    finishStreaming() {
      update(space => {
        if (space.streamingContent) {
          const newMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: space.streamingContent,
            timestamp: Date.now(),
          };
          const updated = {
            ...space,
            messages: [...space.messages, newMessage],
            streamingContent: '',
            isStreaming: false,
          };
          saveToStorage(updated);
          return updated;
        }
        return { ...space, isStreaming: false, streamingContent: '' };
      });
    },

    // Cancel streaming
    cancelStreaming() {
      update(space => ({
        ...space,
        streamingContent: '',
        isStreaming: false,
      }));
    },

    // Add an artifact
    addArtifact(name: string, content: string, type: Artifact['type'] = 'text') {
      update(space => {
        const newArtifact: Artifact = {
          id: crypto.randomUUID(),
          name,
          content,
          type,
          createdAt: Date.now(),
        };
        const updated = {
          ...space,
          artifacts: [...space.artifacts, newArtifact],
        };
        saveToStorage(updated);
        return updated;
      });
    },

    // Update artifact content
    updateArtifact(id: string, content: string) {
      update(space => {
        const updated = {
          ...space,
          artifacts: space.artifacts.map(a =>
            a.id === id ? { ...a, content } : a
          ),
        };
        saveToStorage(updated);
        return updated;
      });
    },

    // Delete an artifact
    deleteArtifact(id: string) {
      update(space => {
        const updated = {
          ...space,
          artifacts: space.artifacts.filter(a => a.id !== id),
        };
        saveToStorage(updated);
        return updated;
      });
    },

    // Clear all messages
    clearMessages() {
      update(space => {
        const updated = { ...space, messages: [] };
        saveToStorage(updated);
        return updated;
      });
    },

    // Clear everything
    clearSpace() {
      const fresh = createDefaultSpace();
      set(fresh);
      saveToStorage(fresh);
    },

    // Get current state
    getState(): PlaygroundSpace {
      return get({ subscribe });
    },
  };
}

export const playgroundStore = createPlaygroundStore();

