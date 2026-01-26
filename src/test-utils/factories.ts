import { AgentConfig } from "../core/config";
import { Task, TaskStatus } from "../core/task";
import { Plan } from "../core/plan";
import { ViberMessage } from "../core/message";
import { generateShortId } from "../utils/id";

export const createAgentConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
  id: overrides.id || `agent-${generateShortId()}`,
  name: "Test Agent",
  description: "A test agent",
  provider: "openai",
  model: "gpt-4",
  tools: [],
  temperature: 0.7,
  maxTokens: 1000,
  ...overrides,
});

export const createTask = (overrides: Partial<ConstructorParameters<typeof Task>[0]> = {}): Task => {
  return new Task({
    id: `task-${generateShortId()}`,
    title: "Test Task",
    description: "A test task",
    status: TaskStatus.PENDING,
    priority: "medium",
    ...overrides,
  });
};

export const createPlan = (goal: string = "Test Goal"): Plan => {
  return new Plan({ goal });
};

export const createMessage = (role: "user" | "assistant" | "system" | "tool", content: string): ViberMessage => ({
  role,
  content,
});
