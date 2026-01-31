/**
 * Daemon runtime - thin clawdbot-alike assistant path
 *
 * No Space, no DataAdapter, no Storage. Loads a single agent config from file
 * and runs streamText. Cockpit owns persistence and context; daemon only
 * orchestrates local skills and the LLM.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "yaml";
import { getViberPath } from "../config";
import type { AgentConfig } from "../core/config";
import { Agent } from "../core/agent";
import type { ViberMessage } from "../core/message";

export interface DaemonRunTaskOptions {
  model?: string;
  singleAgentId?: string;
  agentConfig?: AgentConfig;
  signal?: AbortSignal;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULTS_AGENTS_DIR = path.join(
  path.dirname(__dirname),
  "data",
  "defaults",
  "agents",
);

/**
 * Load agent config from file (no DataAdapter).
 * Tries built-in defaults then ~/.viber/agents/{id}.yaml
 */
export async function loadAgentConfig(
  agentId: string,
): Promise<AgentConfig | null> {
  const tryRead = async (filePath: string): Promise<AgentConfig | null> => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = yaml.parse(content) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") return null;
      return { ...parsed, id: agentId } as AgentConfig;
    } catch {
      return null;
    }
  };

  for (const ext of ["yaml", "yml"]) {
    const fromDefaults = await tryRead(
      path.join(DEFAULTS_AGENTS_DIR, `${agentId}.${ext}`),
    );
    if (fromDefaults) return fromDefaults;
  }

  const root = getViberPath();
  for (const ext of ["yaml", "yml"]) {
    const fromUser = await tryRead(
      path.join(root, "agents", `${agentId}.${ext}`),
    );
    if (fromUser) return fromUser;
  }

  // Fallback: in-code default so daemon works out of the box (clawdbot-alike)
  if (agentId === "default") {
    return {
      id: "default",
      name: "Default",
      description: "General-purpose assistant with local skills.",
      provider: "openrouter",
      model: "deepseek/deepseek-chat",
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt:
        "You are a helpful AI assistant. You help users accomplish their tasks efficiently and effectively. Be concise, accurate, and helpful.",
      tools: [],
      skills: ["tmux", "cursor-agent"],
    } as AgentConfig;
  }

  return null;
}

/**
 * Run a single task: one agent, no Space, no storage.
 * Returns stream result and agent for summary.
 */
export async function runTask(
  goal: string,
  options: DaemonRunTaskOptions & { taskId: string },
  messages?: { role: string; content: string }[],
): Promise<{ streamResult: Awaited<ReturnType<Agent["streamText"]>>; agent: Agent }> {
  const { taskId, singleAgentId = "default", agentConfig: overrideConfig, model: modelOverride, signal } = options;

  let config =
    overrideConfig ?? (await loadAgentConfig(singleAgentId));
  if (!config) {
    throw new Error(`Agent '${singleAgentId}' not found. Add ~/.viber/agents/${singleAgentId}.yaml or use built-in default.`);
  }

  if (modelOverride) {
    config = { ...config, model: modelOverride };
  }

  const agent = new Agent(config as AgentConfig);

  const viberMessages: ViberMessage[] =
    messages && messages.length > 0
      ? messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }))
      : [{ role: "user" as const, content: goal }];

  const streamResult = await agent.streamText({
    messages: viberMessages,
    metadata: { taskId },
    ...(signal && { abortSignal: signal }),
  });

  return { streamResult, agent };
}
