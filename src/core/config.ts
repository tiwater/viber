/**
 * Configuration types for Viber agents and spaces
 */

// Re-export types but avoid ModelConfig conflict
export type { SpaceConfig, SpaceState, SpaceModel } from "../types";

// Re-export AgentConfig if it exists elsewhere, otherwise define it here
export interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  provider?: string;
  model?: string;
  llm?: {
    provider: string;
    model: string;
    settings?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    };
  };
  systemPrompt?: string;
  tools?: string[];
  skills?: string[];
  personality?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  promptFile?: string; // Optional prompt file path
  [key: string]: any; // Allow additional properties
}
