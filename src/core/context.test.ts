import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateTokenCount,
  calculateContextBudget,
  compressMessages,
  validateContext,
  ContextBudget,
} from "./context";
import type { ModelMessage } from "ai";

describe("Context Management", () => {
  describe("estimateTokenCount", () => {
    it("should estimate tokens at 4 chars per token", () => {
      expect(estimateTokenCount("")).toBe(0);
      expect(estimateTokenCount("1234")).toBe(1);
      expect(estimateTokenCount("12345678")).toBe(2);
      expect(estimateTokenCount("Hello World")).toBe(3); // 11 chars → ceil(11/4) = 3
    });

    it("should round up", () => {
      expect(estimateTokenCount("12345")).toBe(2); // 5 chars → ceil(5/4) = 2
    });
  });

  describe("calculateContextBudget", () => {
    it("should calculate available tokens for messages", () => {
      const budget = calculateContextBudget(
        8000, // total limit
        "System prompt", // ~4 tokens
        "", // no tools
        2000 // completion tokens
      );

      expect(budget.totalLimit).toBe(8000);
      expect(budget.completion).toBe(2000);
      expect(budget.overhead).toBe(500);
      expect(budget.availableForMessages).toBeGreaterThan(0);
    });

    it("should account for tools", () => {
      const budgetWithTools = calculateContextBudget(
        8000,
        "System",
        "Tool definitions here",
        2000
      );
      const budgetWithoutTools = calculateContextBudget(
        8000,
        "System",
        "",
        2000
      );

      expect(budgetWithTools.availableForMessages).toBeLessThan(
        budgetWithoutTools.availableForMessages
      );
    });

    it("should use default completion tokens", () => {
      const budget = calculateContextBudget(8000, "System");
      expect(budget.completion).toBe(4000);
    });
  });

  describe("compressMessages", () => {
    const budget: ContextBudget = {
      totalLimit: 8000,
      systemPrompt: 100,
      tools: 100,
      completion: 2000,
      overhead: 500,
      availableForMessages: 5000,
    };

    it("should return messages as-is if within budget", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = await compressMessages(messages, budget);
      expect(result).toHaveLength(2);
    });

    it("should truncate messages if over budget", async () => {
      const smallBudget: ContextBudget = {
        ...budget,
        availableForMessages: 50, // Very small budget
      };

      const messages: ModelMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: "user",
          content: `Message ${i} with some extra content to take up space`,
        });
      }

      const result = await compressMessages(messages, smallBudget);
      expect(result.length).toBeLessThan(messages.length);
    });

    it("should preserve system messages when truncating", async () => {
      const smallBudget: ContextBudget = {
        ...budget,
        availableForMessages: 100,
      };

      const messages: ModelMessage[] = [
        { role: "system", content: "System instructions" },
        { role: "user", content: "First message with lots of content ".repeat(10) },
        { role: "assistant", content: "Response ".repeat(10) },
        { role: "user", content: "Second message" },
      ];

      const result = await compressMessages(messages, smallBudget);
      // System message should be preserved
      expect(result.some((m) => m.role === "system")).toBe(true);
    });
  });

  describe("validateContext", () => {
    const budget: ContextBudget = {
      totalLimit: 8000,
      systemPrompt: 100,
      tools: 100,
      completion: 2000,
      overhead: 500,
      availableForMessages: 5300,
    };

    it("should validate context within limits", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      const result = validateContext(messages, budget);
      expect(result.valid).toBe(true);
    });

    it("should reject context exceeding 95% of limit", () => {
      // Create messages that will exceed the limit
      const largeContent = "x".repeat(30000); // ~7500 tokens
      const messages: ModelMessage[] = [{ role: "user", content: largeContent }];

      const result = validateContext(messages, budget);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("exceeds 95%");
    });
  });
});
