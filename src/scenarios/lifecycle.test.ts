import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../core/agent';
import { ViberDataManager } from '../data/manager';
import { MockDataAdapter, createMockAIProvider } from '../test-utils';
import type { AgentConfig } from '../core/config';
import type { Space } from '../data/types';

// Mock AI SDK
const { generateText, streamText } = vi.hoisted(() => {
    // We can't use createMockAIProvider directly here because it's imported from outside
    // But we can reproduce the object structure
    return {
        generateText: vi.fn(() => Promise.resolve({
            text: "Mocked generated text",
            toolCalls: [],
        })),
        streamText: vi.fn(() => ({
            fullStream: (async function* () {})(),
            textStream: (async function* () {})(),
            text: "Mocked streamed text",
            agentMetadata: { name: "test-agent" },
        })),
    };
});

vi.mock("ai", () => ({ generateText, streamText }));

// Mock provider factory to return dummy model
vi.mock("../core/provider", () => ({
  getModelProvider: () => (model: string) => ({ modelId: model, provider: "mock" }),
}));

// Mock tool building (since we don't want to load real tools)
vi.mock("../core/tool", () => ({
  buildToolMap: vi.fn(() => Promise.resolve({})),
}));

describe('Lifecycle Integration', () => {
    let adapter: MockDataAdapter;
    let manager: ViberDataManager;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new MockDataAdapter();
        manager = new ViberDataManager(adapter);
    });

    it('should create space, agent and run simple interaction', async () => {
        // 1. Create Space
        const space = await manager.createSpace({ name: 'Test Space' });
        expect(space.id).toBeDefined();

        // 2. Create Agent Config
        const agentConfig: AgentConfig = {
            id: 'agent-1',
            name: 'Helper',
            description: 'A helper',
            provider: 'openai',
            model: 'gpt-4',
            systemPrompt: 'You are helpful'
        };

        // 3. Instantiate Agent
        const agent = new Agent(agentConfig);

        // 4. Run interaction
        // We use the space created in step 1
        const result = await agent.generateText({
            messages: [{ role: 'user', content: 'Hello' }],
            spaceId: space.id,
            metadata: { userId: 'user-1' }
        });

        expect(result.text).toBe("Mocked generated text");
        expect(generateText).toHaveBeenCalled();

        // Check that proper context was passed (implicit verification via mock call args if needed)
        // const calls = (generateText as any).mock.calls;
        // expect(calls[0][0].system).toContain('Space ID: ' + space.id);
    });
});
