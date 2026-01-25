import { vi } from 'vitest';
import { DataAdapter } from '../data/adapter';

export const mockAiSdk = () => {
  vi.mock('ai', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ai')>();
    return {
      ...actual,
      streamText: vi.fn().mockImplementation((options) => {
        // Return a mock result structure compatible with AI SDK
        return {
          fullStream: (async function* () {
             yield { type: 'text-delta', textChunk: 'Mock response' };
             yield { type: 'finish', finishReason: 'stop' };
          })(),
          textStream: (async function* () {
            yield 'Mock response';
          })(),
          text: Promise.resolve('Mock response'),
          agentMetadata: { name: 'mock-agent' },
        };
      }),
      generateText: vi.fn().mockResolvedValue({
        text: 'Mock generated text',
        toolCalls: [],
      }),
    };
  });
};

export const createMockDataAdapter = (): DataAdapter => ({
  // Agents
  getAgents: vi.fn(),
  getAgent: vi.fn(),
  saveAgent: vi.fn(),
  deleteAgent: vi.fn(),
  cloneAgent: vi.fn(),

  // Tools
  getTools: vi.fn(),
  getTool: vi.fn(),
  saveTool: vi.fn(),
  deleteTool: vi.fn(),
  cloneTool: vi.fn(),

  // Spaces
  getSpaces: vi.fn(),
  getSpace: vi.fn(),
  saveSpace: vi.fn(),
  deleteSpace: vi.fn(),

  // Artifacts
  getArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  saveArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  getArtifactsBySpace: vi.fn(),
  getArtifactsByTask: vi.fn(),
  getArtifactsByCategory: vi.fn(),

  // Tasks
  getTasks: vi.fn(),
  getTask: vi.fn(),
  saveTask: vi.fn(),
  deleteTask: vi.fn(),

  // Legacy Conversations
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  saveConversation: vi.fn(),
  deleteConversation: vi.fn(),

  // Model Providers
  getModelProviders: vi.fn(),
  getModelProvider: vi.fn(),
  saveModelProvider: vi.fn(),
  deleteModelProvider: vi.fn(),

  // Datasources
  getDatasources: vi.fn(),
  getDatasource: vi.fn(),
  saveDatasource: vi.fn(),
  deleteDatasource: vi.fn(),
});
