import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidTool, clearToolCache, buildToolMap, CoreTool } from "./tool";
import { z } from "zod";

// Mock the data factory
vi.mock("../data/factory", () => ({
  getServerDataAdapter: () => ({
    getTools: vi.fn(() => Promise.resolve([
      { id: 'mcp-server-1', name: 'MCP Server 1' } // Mock existing MCP server
    ])),
  }),
}));

// Mock custom tools
vi.mock("../tools", () => ({
  buildToolMap: vi.fn((ids: string[]) => {
    const tools: Record<string, CoreTool> = {};
    if (ids.includes('test-tool')) {
      tools['test-tool'] = {
        description: 'A test tool',
        inputSchema: z.object({ param: z.string() }),
        execute: async ({ param }) => `Executed with ${param}`,
      };
    }
    if (ids.includes('failing-tool')) {
      tools['failing-tool'] = {
        description: 'A failing tool',
        inputSchema: z.object({}),
        execute: async () => { throw new Error('Tool execution failed'); },
      };
    }
    return tools;
  }),
}));

describe("Tool System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearToolCache();
  });

  describe("isValidTool", () => {
    it("should return true for valid tool", () => {
      const validTool = {
        description: "A test tool",
        execute: async () => "result",
        inputSchema: z.object({}),
      };
      expect(isValidTool(validTool)).toBe(true);
    });

    it("should return false for invalid tool (missing execute)", () => {
      const invalidTool = {
        description: "A test tool",
        inputSchema: z.object({}),
      };
      expect(isValidTool(invalidTool)).toBe(false);
    });

    it("should return false for invalid tool (missing description)", () => {
      const invalidTool = {
        execute: async () => "result",
        inputSchema: z.object({}),
      };
      expect(isValidTool(invalidTool)).toBe(false);
    });
  });

  describe("buildToolMap", () => {
    it("should return empty object when no tools configured", async () => {
      const tools = await buildToolMap([]);
      expect(tools).toEqual({});
    });

    it("should load custom tools", async () => {
      const tools = await buildToolMap(['test-tool']);
      expect(tools).toHaveProperty('test-tool');
      expect(tools['test-tool'].description).toBe('A test tool');
    });

    it("should handle mixed tools (custom and mcp)", async () => {
      // 'mcp-server-1' matches the mocked data adapter
      const tools = await buildToolMap(['test-tool', 'mcp-server-1']);
      expect(tools).toHaveProperty('test-tool');
      // MCP loading is mocked to warn and skip in the implementation, so it won't be in the result
      // but the function should run without error
    });
  });

  describe("Tool Execution (Integration)", () => {
    it("should execute a valid tool", async () => {
      const tools = await buildToolMap(['test-tool']);
      const result = await tools['test-tool'].execute({ param: 'test' });
      expect(result).toBe('Executed with test');
    });

    it("should handle execution errors", async () => {
      const tools = await buildToolMap(['failing-tool']);
      await expect(tools['failing-tool'].execute({})).rejects.toThrow('Tool execution failed');
    });

    it("should validate input schema", async () => {
       // Note: Validation is typically handled by the AI SDK before calling execute,
       // but we can check if the schema exists and is correct
       const tools = await buildToolMap(['test-tool']);
       const schema = tools['test-tool'].inputSchema;
       expect(schema).toBeDefined();

       const valid = schema.safeParse({ param: 'ok' });
       expect(valid.success).toBe(true);

       const invalid = schema.safeParse({ param: 123 });
       expect(invalid.success).toBe(false);
    });
  });
});
