import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidTool, clearToolCache, buildToolMap } from "./tool";

// Use vi.hoisted to ensure mocks are available for vi.mock factories
const { mockGetTools, mockBuildCustomToolMap } = vi.hoisted(() => {
  return {
    mockGetTools: vi.fn(() => Promise.resolve([
      { id: "mcp-server-1" },
      { id: "mcp:server-2" }
    ])),
    mockBuildCustomToolMap: vi.fn((ids: any[]) => {
      const tools: any = {};
      ids.forEach((id: string) => {
        tools[id] = {
          description: `Custom Tool ${id}`,
          execute: async () => `Executed ${id}`,
          inputSchema: {}
        };
      });
      return tools;
    })
  };
});

vi.mock("../data/factory", () => ({
  getServerDataAdapter: () => ({
    getTools: mockGetTools,
  }),
}));

vi.mock("../tools", () => ({
  buildToolMap: mockBuildCustomToolMap,
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
        inputSchema: {}
      };
      expect(isValidTool(validTool)).toBe(true);
    });

    it("should return false for invalid tool", () => {
      expect(isValidTool(null)).toBe(false);
      expect(isValidTool({})).toBe(false);
      expect(isValidTool({ description: "No execute" })).toBe(false);
      expect(isValidTool({ execute: () => {} })).toBe(false); // missing description
    });
  });

  describe("buildToolMap", () => {
    it("should return empty object when no tools configured", async () => {
      const tools = await buildToolMap([]);
      expect(tools).toEqual({});
    });

    it("should load custom tools", async () => {
      const tools = await buildToolMap(["custom-tool-1"]);
      expect(mockBuildCustomToolMap).toHaveBeenCalledWith(["custom-tool-1"], undefined);
      expect(tools["custom-tool-1"]).toBeDefined();
      expect(tools["custom-tool-1"].description).toBe("Custom Tool custom-tool-1");
    });

    it("should separate MCP tools from custom tools", async () => {
      // mcp-server-1 is in the mockGetTools response
      const toolIds = ["custom-tool-1", "mcp-server-1"];

      const tools = await buildToolMap(toolIds);

      // Should have called custom tool builder ONLY with custom tool
      expect(mockBuildCustomToolMap).toHaveBeenCalledWith(["custom-tool-1"], undefined);

      // MCP tool loading logic is currently stubbed to warn and return empty
      // so we expect only custom tool to be present in result
      expect(tools["custom-tool-1"]).toBeDefined();
      expect(tools["mcp-server-1"]).toBeUndefined();
    });

    it("should handle mixed inputs correctly", async () => {
      const toolIds = ["custom-1", "custom-2", "mcp-server-1"];
      await buildToolMap(toolIds);
      expect(mockBuildCustomToolMap).toHaveBeenCalledWith(["custom-1", "custom-2"], undefined);
    });
  });
});
