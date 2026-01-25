import { Agent } from '../core/agent';
import { Task, TaskStatus } from '../core/task';
import { Plan } from '../core/plan';
import { ViberMessage } from '../core/message';
import { AgentConfig } from '../core/config';

export const createTestAgent = (overrides: Partial<AgentConfig> = {}): Agent => {
  const defaultConfig: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    provider: 'openai',
    model: 'gpt-4',
    tools: [],
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: 'You are a test agent.',
    ...overrides,
  };
  return new Agent(defaultConfig);
};

export const createTestTask = (overrides: Partial<ConstructorParameters<typeof Task>[0]> = {}): Task => {
  return new Task({
    id: 'test-task',
    title: 'Test Task',
    description: 'Description',
    ...overrides,
  });
};

export const createTestPlan = (overrides: Partial<ConstructorParameters<typeof Plan>[0]> = {}): Plan => {
  return new Plan({
    goal: 'Test Goal',
    ...overrides,
  });
};

export const createTestMessage = (role: ViberMessage['role'], content: string): ViberMessage => {
  return {
    role,
    content,
    id: `msg-${Math.random().toString(36).substring(7)}`,
    metadata: { timestamp: Date.now() },
  };
};
