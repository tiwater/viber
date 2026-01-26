/**
 * Tools Registry
 *
 * Dynamic tool discovery and management system.
 * Tools are discovered from tool classes using decorators.
 */

import { CoreTool } from "../core/tool";
import { Tool } from "./base";
import { skillRegistry } from "../core/skills";
import { registerDefaultSkills } from "../skills";

// Register skills on load
registerDefaultSkills();

// Import all tools
import { FileTool } from "./file";
import { SearchTool } from "./search";
import { WebTool } from "./web";

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string; // Icon name (Lucide icon name, Icons component key, or URL)
  tags?: string[]; // Tags for categorization and filtering
  features?: string[]; // List of features the tool provides
  tools: string[]; // Keep for backward compatibility
  functions?: any[]; // New field for function names/objects
  functionDetails?: Array<{
    name: string;
    description: string;
    parameters: any;
  }>; // Detailed function info
  configSchema?: any; // Configuration schema for the tool
  enabled?: boolean;
}

// Tool instances (created on demand)
const toolInstances = new Map<string, Tool>();

// Available tool classes
const toolClasses = new Map<string, new () => Tool>([
  ["file", FileTool],
  ["search", SearchTool],
  ["web", WebTool],
]);

/**
 * Load tool configuration through DataAdapter
 */
async function loadToolConfig(toolId: string): Promise<any> {
  try {
    const { getServerDataAdapter } = await import("../data/factory");
    const adapter = getServerDataAdapter();

    // Get tool from adapter
    const tool = await adapter.getTool(toolId);
    return tool?.config || {};
  } catch (error) {
    console.error(`[loadToolConfig] Error loading config for ${toolId}:`, error);
    return {};
  }
}

/**
 * Get or create a tool instance
 */
export function getToolInstance(toolId: string): Tool | null {
  if (!toolInstances.has(toolId)) {
    const ToolClass = toolClasses.get(toolId);
    if (!ToolClass) return null;

    try {
      const instance = new ToolClass();

      // Load configuration from file if available
      // This is async but we handle it synchronously for now
      // In production, configuration should be loaded at startup
      loadToolConfig(toolId)
        .then((config) => {
          if (Object.keys(config).length > 0) {
            instance.setConfig(config);
          }
        })
        .catch((error) => {
          console.error(`[getToolInstance] Error loading config for ${toolId}:`, error);
        });

      // Check if tool is available
      if (!instance.isAvailable()) {
        console.warn(`[getToolInstance] Tool ${toolId} is not available`);
        return null;
      }

      toolInstances.set(toolId, instance);
    } catch (error) {
      console.warn(`[Tools] Failed to initialize tool ${toolId}:`, error);
      return null;
    }
  }
  return toolInstances.get(toolId) || null;
}

// Static function details for server-side rendering
const staticFunctionDetails = {
  file: [
    {
      name: "createFile",
      description:
        "Create a new file or overwrite an existing file with the specified content. Creates parent directories if they don't exist.",
      parameters: {},
    },
    {
      name: "readFile",
      description:
        "Read the contents of a file from the file system. Returns the file content along with metadata like size and modification time.",
      parameters: {},
    },
    {
      name: "deleteFile",
      description:
        "Delete a file from the file system. This operation is irreversible. The file must exist or an error will be thrown.",
      parameters: {},
    },
    {
      name: "listFiles",
      description:
        "List all files in a directory with optional recursive traversal and pattern filtering. Returns an array of file paths.",
      parameters: {},
    },
    {
      name: "moveFile",
      description:
        "Move or rename a file from one location to another. Creates parent directories if needed. The source file will no longer exist after this operation.",
      parameters: {},
    },
    {
      name: "copyFile",
      description:
        "Copy a file from one location to another. Creates parent directories if needed. The source file remains unchanged.",
      parameters: {},
    },
    {
      name: "fileExists",
      description:
        "Check if a file or directory exists at the specified path. Returns existence status and file metadata if it exists.",
      parameters: {},
    },
  ],
  search: [
    {
      name: "search",
      description:
        "Search the web for information using configured search providers (Tavily or Serper). Returns relevant web pages with titles, URLs, and snippets.",
      parameters: {},
    },
  ],
  web: [
    {
      name: "fetchWebpage",
      description:
        "Extract and parse web page content into structured formats (markdown, text, HTML). Supports JavaScript-rendered pages and can capture metadata, links, and images. Uses Firecrawl or Jina services for reliable extraction.",
      parameters: {},
    },
    {
      name: "crawlWebsite",
      description:
        "Crawl a website to extract content from multiple pages. Follows links up to a specified depth and returns structured content from all discovered pages. Useful for documentation sites, blogs, or comprehensive site analysis.",
      parameters: {},
    },
    {
      name: "checkUrl",
      description:
        "Check if a URL is accessible and retrieve basic information about the resource. Returns HTTP status, content type, size, and last modified date without downloading the full content.",
      parameters: {},
    },
  ],
};

/**
 * Get all tools info
 */
export function getToolProviders(): ToolInfo[] {
  // Check if we're in a server environment
  if (typeof window === "undefined") {
    // In server/edge runtime, some tools might not work due to Node.js dependencies
    // Return tool metadata without instantiation
    const tools: ToolInfo[] = [
      {
        id: "file",
        name: "File System Tools",
        description:
          "Read, write, manage and manipulate files and directories in the local file system",
        category: "file",
        icon: "FolderOpen",
        tags: ["Files", "Storage", "Local", "System", "IO"],
        tools: [
          "createFile",
          "readFile",
          "deleteFile",
          "listFiles",
          "moveFile",
          "copyFile",
          "fileExists",
        ],
        functions: [
          "createFile",
          "readFile",
          "deleteFile",
          "listFiles",
          "moveFile",
          "copyFile",
          "fileExists",
        ],
        functionDetails: staticFunctionDetails.file,
        configSchema: {
          basePath: {
            name: "Base Path",
            type: "string",
            description: "Base directory for file operations",
            defaultValue: process.cwd(),
            required: false,
          },
          allowAbsolutePaths: {
            name: "Allow Absolute Paths",
            type: "boolean",
            description:
              "Allow operations on absolute paths outside the base directory",
            defaultValue: false,
            required: false,
          },
          maxFileSize: {
            name: "Max File Size",
            type: "number",
            description: "Maximum file size in bytes",
            defaultValue: 10485760,
            required: false,
          },
        },
        enabled: true,
      },
      {
        id: "search",
        name: "Web Search",
        description:
          "Search the web for current information using configured search providers",
        category: "search",
        icon: "Search",
        tags: ["Search", "Web", "Research", "Internet", "Information"],
        tools: ["search"],
        functions: ["search"],
        functionDetails: staticFunctionDetails.search,
        configSchema: {
          defaultProvider: {
            name: "默认搜索提供商",
            type: "select",
            description: "选择默认使用的搜索引擎提供商",
            options: [
              { value: "auto", label: "自动选择", description: "根据可用性自动选择最佳搜索引擎" },
              { value: "tavily", label: "Tavily", description: "专为 AI 优化的搜索引擎，提供高质量结构化结果" },
              { value: "serper", label: "Serper", description: "Google 搜索 API，提供全面的搜索结果" },
            ],
            defaultValue: "auto",
            required: false,
          },
          enableFallback: {
            name: "启用备用提供商",
            type: "boolean",
            description: "当主提供商失败时自动切换到备用提供商",
            defaultValue: true,
            required: false,
          },
          tavilyApiKey: {
            name: "Tavily API 密钥",
            type: "string",
            description: "用于 Tavily 网络搜索服务的 API 密钥。可以在此直接设置，或通过环境变量 TAVILY_API_KEY 提供",
            envVar: "TAVILY_API_KEY",
            required: false,
          },
          serperApiKey: {
            name: "Serper API 密钥",
            type: "string",
            description: "用于 Serper (Google 搜索) 服务的 API 密钥。可以在此直接设置，或通过环境变量 SERPER_API_KEY 提供",
            envVar: "SERPER_API_KEY",
            required: false,
          },
          defaultLanguage: {
            name: "默认语言",
            type: "select",
            description: "搜索结果的默认语言偏好",
            options: [
              { value: "auto", label: "自动检测" },
              { value: "zh-CN", label: "简体中文" },
              { value: "zh-TW", label: "繁体中文" },
              { value: "en", label: "English" },
              { value: "ja", label: "日本語" },
              { value: "ko", label: "한국어" },
            ],
            defaultValue: "auto",
            required: false,
          },
          defaultCountry: {
            name: "默认地区",
            type: "select",
            description: "搜索结果的默认地区偏好",
            options: [
              { value: "auto", label: "自动选择" },
              { value: "CN", label: "中国大陆" },
              { value: "TW", label: "中国台湾省" },
              { value: "HK", label: "中国香港" },
              { value: "US", label: "美国" },
              { value: "JP", label: "日本" },
              { value: "KR", label: "韩国" },
            ],
            defaultValue: "auto",
            required: false,
          },
          defaultSearchType: {
            name: "默认搜索类型",
            type: "select",
            description: "默认的搜索类型",
            options: [
              { value: "general", label: "常规搜索" },
              { value: "news", label: "新闻搜索" },
            ],
            defaultValue: "general",
            required: false,
          },
          defaultNewsDays: {
            name: "新闻时间范围",
            type: "number",
            description: "新闻搜索的默认时间范围（天数）",
            defaultValue: 7,
            required: false,
          },
          includeDomains: {
            name: "优先域名",
            type: "array",
            description: "优先显示这些域名的搜索结果（例如：[\"baidu.com\", \"zhihu.com\"]）",
            defaultValue: [],
            required: false,
          },
          excludeDomains: {
            name: "排除域名",
            type: "array",
            description: "从搜索结果中排除这些域名",
            defaultValue: [],
            required: false,
          },
        },
        enabled: true,
      },
      {
        id: "web",
        name: "Web Tools",
        description:
          "Extract web content, check URL availability, and crawl websites",
        category: "web",
        icon: "Globe",
        tags: ["Web", "Extraction", "Crawling", "Content", "Scraping"],
        tools: ["fetchWebpage", "crawlWebsite", "checkUrl"],
        functions: ["fetchWebpage", "crawlWebsite", "checkUrl"],
        functionDetails: staticFunctionDetails.web,
        configSchema: {
          firecrawlApiKey: {
            name: "Firecrawl API Key",
            type: "password",
            description: "API key for Firecrawl web extraction service",
            envVar: "FIRECRAWL_API_KEY",
            required: false,
          },
          jinaApiKey: {
            name: "Jina API Key",
            type: "password",
            description: "API key for Jina web extraction service",
            envVar: "JINA_API_KEY",
            required: false,
          },
          defaultProvider: {
            name: "Default Provider",
            type: "select",
            description: "Preferred web extraction provider",
            options: ["firecrawl", "jina"],
            defaultValue: "firecrawl",
            required: false,
          },
        },
        enabled: true,
      },
    ];
    return tools;
  }

  // Original client-side code
  const tools: ToolInfo[] = [];

  for (const [id, ToolClass] of toolClasses) {
    try {
      const instance = new ToolClass();
      const metadata = instance.getMetadata();

      // Only include if available
      if (instance.isAvailable()) {
        // Add tags based on tool ID
        const tags =
          id === "file"
            ? ["Files", "Storage", "Local", "System", "IO"]
            : id === "search"
            ? ["Search", "Web", "Research", "Internet", "Information"]
            : id === "web"
            ? ["Web", "Extraction", "Crawling", "Content", "Scraping"]
            : [];

        tools.push({
          ...metadata,
          tags,
          tools: instance.getToolNames(),
          functions: instance.getToolNames(),
          functionDetails: instance.getToolDetails(),
          configSchema: instance.getConfigSchema(),
          enabled: true,
        });
      }
    } catch (error) {
      console.warn(`[Tools] Failed to get metadata for tool ${id}:`, error);
    }
  }

  return tools;
}

/**
 * Get a specific tool info
 */
export function getToolProvider(toolId: string): ToolInfo | null {
  const ToolClass = toolClasses.get(toolId);
  if (!ToolClass) return null;

  try {
    const instance = new ToolClass();
    const metadata = instance.getMetadata();

    // Add tags based on tool ID
    const tags =
      toolId === "file"
        ? ["Files", "Storage", "Local", "System", "IO"]
        : toolId === "search"
        ? ["Search", "Web", "Research", "Internet", "Information"]
        : toolId === "web"
        ? ["Web", "Extraction", "Crawling", "Content", "Scraping"]
        : [];

    return {
      ...metadata,
      tags,
      tools: instance.getToolNames(),
      functions: instance.getToolNames(),
      functionDetails: instance.getToolDetails(),
      configSchema: instance.getConfigSchema(),
      enabled: instance.isAvailable(),
    };
  } catch (error) {
    console.warn(`[Tools] Failed to get metadata for tool ${toolId}:`, error);
    return null;
  }
}

/**
 * Enable or disable a tool
 */
export function setProviderEnabled(
  _toolId: string,
  _enabled: boolean
): boolean {
  // For now, this is controlled by availability (API keys, etc)
  // In the future we might store enable/disable state separately
  console.warn(`[Tools] setProviderEnabled is not fully implemented yet`);
  return true;
}

/**
 * Build a tool map for specific tool IDs
 * This is the ONLY function that core/tool.ts imports
 */
export function buildToolMap(
  toolIds: string[],
  context?: { spaceId?: string }
): Record<string, CoreTool> {
  const tools: Record<string, CoreTool> = {};

  for (const toolId of toolIds) {
    // Check if this is a tool class ID (e.g., 'file', 'web', 'search')
    if (toolClasses.has(toolId)) {
      // Get all functions from this tool class
      const tool = getToolInstance(toolId);
      if (tool) {
        // Set space context for space-aware tools
        if (context?.spaceId) {
          tool.setSpaceId(context.spaceId);
        }
        const toolFunctions = tool.getTools();
        // Add all functions from this tool class
        Object.assign(tools, toolFunctions);
        continue;
      }
    }

    // Check if this is a skill ID
    if (skillRegistry.has(toolId)) {
      const skill = skillRegistry.get(toolId)!;
      for (const [name, toolDef] of Object.entries(skill.tools)) {
        tools[name] = {
          description: toolDef.description,
          inputSchema: toolDef.parameters,
          execute: toolDef.execute,
        };
      }
      continue;
    }

    // Otherwise, try to find it as a specific function
    let found = false;

    // Check skills for specific functions
    for (const skill of skillRegistry.getAll()) {
      if (toolId in skill.tools) {
        const toolDef = skill.tools[toolId];
        tools[toolId] = {
          description: toolDef.description,
          inputSchema: toolDef.parameters,
          execute: toolDef.execute,
        };
        found = true;
        break;
      }
    }
    if (found) continue;

    for (const [id] of toolClasses) {
      const tool = getToolInstance(id);
      if (!tool) continue;

      // Set space context for space-aware tools
      if (context?.spaceId) {
        tool.setSpaceId(context.spaceId);
      }

      // Get all tool functions from this class
      const toolFunctions = tool.getTools();

      // Check if this tool has the requested function
      if (toolId in toolFunctions) {
        tools[toolId] = toolFunctions[toolId];
        found = true;
        break; // Found the tool, no need to check other classes
      }
    }

    if (!found) {
      console.warn(`[Tools] Tool not found: ${toolId}`);
    }
  }

  return tools;
}

/**
 * Get all available tool IDs
 * Useful for discovery/listing
 */
export function getAllToolIds(): string[] {
  const ids: string[] = [];

  for (const [toolId] of toolClasses) {
    const tool = getToolInstance(toolId);
    if (!tool) continue;

    const toolFunctions = tool.getTools();
    ids.push(...Object.keys(toolFunctions));
  }

  for (const skill of skillRegistry.getAll()) {
    ids.push(...Object.keys(skill.tools));
  }

  return ids;
}

/**
 * Get all available tool IDs for a specific tool
 */
export function getProviderToolIds(toolId: string): string[] {
  const tool = getToolInstance(toolId);
  if (!tool) return [];

  const toolFunctions = tool.getTools();
  return Object.keys(toolFunctions);
}

/**
 * Check if a tool ID is available
 */
export function isToolAvailable(toolId: string): boolean {
  // Check skills
  if (skillRegistry.has(toolId)) return true;
  for (const skill of skillRegistry.getAll()) {
    if (toolId in skill.tools) {
      return true;
    }
  }

  for (const [id] of toolClasses) {
    const tool = getToolInstance(id);
    if (!tool) continue;

    const toolFunctions = tool.getTools();
    if (toolId in toolFunctions) {
      return true;
    }
  }

  return false;
}

// Export for backward compatibility
export function getAvailableTools(): string[] {
  return getAllToolIds();
}

// Backward compatibility exports (to be removed eventually)
export type ToolProviderInfo = ToolInfo;

// Export registry functions for static access (no instantiation)
