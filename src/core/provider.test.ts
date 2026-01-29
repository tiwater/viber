import { describe, it, expect } from "vitest";
import { parseModelString } from "./provider";

describe("parseModelString", () => {
  it("returns openrouter provider for upstream provider/model format", () => {
    const config = parseModelString("deepseek/deepseek-chat");
    expect(config.provider).toBe("openrouter");
    expect(config.modelName).toBe("deepseek/deepseek-chat");
  });

  it("strips openrouter/ prefix so model ID is valid for OpenRouter API", () => {
    // OpenRouter API expects "deepseek/deepseek-chat", not "openrouter/deepseek/deepseek-chat"
    const config = parseModelString("openrouter/deepseek/deepseek-chat");
    expect(config.provider).toBe("openrouter");
    expect(config.modelName).toBe("deepseek/deepseek-chat");
    expect(config.modelName).not.toContain("openrouter/");
  });

  it("passes through openai/gpt-4o-mini as-is (no openrouter prefix)", () => {
    const config = parseModelString("openai/gpt-4o-mini");
    expect(config.provider).toBe("openrouter");
    expect(config.modelName).toBe("openai/gpt-4o-mini");
  });

  it("returns openai provider for simple gpt model names", () => {
    const config = parseModelString("gpt-4o-mini");
    expect(config.provider).toBe("openai");
    expect(config.modelName).toBe("gpt-4o-mini");
  });

  it("returns anthropic provider for claude- prefix", () => {
    const config = parseModelString("claude-3-5-sonnet");
    expect(config.provider).toBe("anthropic");
    expect(config.modelName).toBe("claude-3-5-sonnet");
  });
});
