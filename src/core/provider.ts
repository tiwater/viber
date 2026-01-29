/**
 * AI Provider Management
 * Handles initialization and configuration of different AI providers
 *
 * Philosophy: Keep it simple - agents specify their provider and model explicitly.
 *
 * To add a new provider (e.g., Google, Mistral, Cohere):
 * 1. Install: `pnpm add @ai-sdk/google`
 * 2. Import: `import { createGoogleGenerativeAI } from "@ai-sdk/google";`
 * 3. Add case: `case "google": return createGoogleGenerativeAI({...})`
 * 4. Add environment variable handling
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export type ModelProvider = string; // Allow any provider string for extensibility

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  apiKey?: string;
  baseURL?: string;
  // Viber-specific options
  spaceId?: string;
  userId?: string; // For usage tracking (e.g., Helicone)
  storageRoot?: string;
  teamConfig?: string;
  defaultGoal?: string;
}

/**
 * Get the appropriate AI provider instance
 */
export function getModelProvider(config: ModelConfig) {
  const {
    provider,
    apiKey,
    baseURL,
    spaceId,
    userId,
    storageRoot,
    teamConfig,
    defaultGoal,
  } = config;

  switch (provider) {
    case "anthropic":
      return createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: baseURL || process.env.ANTHROPIC_BASE_URL,
      });

    case "openai":
      return createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        baseURL: baseURL || process.env.OPENAI_BASE_URL,
      });

    case "deepseek":
      return deepseek;

    case "openrouter":
      // Use the official OpenRouter SDK (v2.0.2+ for AI SDK 6 compatibility)
      const openrouterConfig: any = {
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      };

      // Use Helicone gateway for observability if configured
      if (process.env.HELICONE_API_KEY) {
        openrouterConfig.baseURL =
          baseURL || "https://openrouter.helicone.ai/api/v1";
        openrouterConfig.headers = {
          "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
          "Helicone-Property-User": userId || "anonymous",
          "Helicone-Property-Space": spaceId || "default",
        };
      }

      return createOpenRouter(openrouterConfig);

    default:
      // For other providers, assume they follow the standard pattern
      // This allows users to add support for Google, Mistral, Cohere, etc.
      // by providing the appropriate imports and configuration
      throw new Error(
        `Provider '${provider}' is not configured. ` +
          `To use ${provider}, add the appropriate AI SDK provider import and configuration to core/provider.ts`,
      );
  }
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: string): boolean {
  switch (provider) {
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "deepseek":
      return !!process.env.DEEPSEEK_API_KEY;
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "google":
      // Google provider needs to be imported and configured
      return false; // Not yet implemented
    case "mistral":
      return false; // Not yet implemented
    case "cohere":
      return false; // Not yet implemented
    default:
      return false;
  }
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): string[] {
  const providers = [
    "anthropic",
    "openai",
    "deepseek",
    "openrouter",
    "google",
    "mistral",
    "cohere",
  ];
  return providers.filter(isProviderConfigured);
}

/**
 * Parse model string to extract provider and model name
 * Examples: "gpt-4o" -> { provider: "openai", modelName: "gpt-4o" }
 */
export function parseModelString(model: string): ModelConfig {
  // Viber models are handled differently - not through this parser
  // if (model.startsWith("viber-") || model === "viber") {
  //   return { provider: "viber", modelName: model };
  // }

  // Anthropic models (direct access)
  if (model.startsWith("claude-")) {
    return { provider: "anthropic", modelName: model };
  }

  // Deepseek models (direct access)
  if (model.startsWith("deepseek-")) {
    return { provider: "deepseek", modelName: model };
  }

  // Models with "/" are OpenRouter format (e.g., "deepseek/deepseek-chat", "openai/gpt-4o-mini")
  // OpenRouter API expects upstream provider/model only — never prefix with "openrouter/"
  if (model.includes("/")) {
    const modelName = model.startsWith("openrouter/")
      ? model.slice("openrouter/".length)
      : model;
    return { provider: "openrouter", modelName };
  }

  // Simple model names default to OpenAI (e.g., "gpt-4o", "gpt-4o-mini")
  return { provider: "openai", modelName: model };
}

/**
 * Get context limit for a model
 */
export function getModelContextLimit(modelName: string): number {
  const contextLimits: Record<string, number> = {
    // Viber (uses underlying model limits dynamically)
    viber: 100000,
    "viber-default": 100000,

    // Deepseek
    "deepseek-chat": 65536,
    "deepseek-reasoner": 65536,

    // OpenRouter models
    "anthropic/claude-3.5-sonnet": 150000,
    "anthropic/claude-3.5-haiku": 150000,
    "openai/gpt-4o": 100000,
    "openai/o1-preview": 100000,
    "google/gemini-2.0-flash-exp:free": 100000,
    "meta-llama/llama-3.3-70b-instruct": 32000,

    // Anthropic
    "claude-3-5-sonnet-20240620": 150000,
    "claude-3-haiku-20240307": 150000,
    "claude-3-opus-20240229": 150000,

    // OpenAI
    "gpt-4o": 100000,
    "gpt-4o-mini": 100000,
    "gpt-4-turbo": 100000,
    "gpt-3.5-turbo": 16000,
  };

  return contextLimits[modelName] || 50000; // Default to 50k
}

/**
 * Get completion token reservation for a model
 */
export function getCompletionTokens(modelName: string): number {
  if (modelName.startsWith("deepseek-reasoner")) {
    return 32000; // Deepseek reasoner needs more tokens
  }
  if (modelName.startsWith("deepseek-")) {
    return 8000;
  }
  return 4000; // Default for most models
}
