import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { Skill, SkillModule } from "./types";
import { CoreTool } from "../tool";

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private loadedTools: Map<string, Record<string, CoreTool>> = new Map();

  constructor(private skillsRoot: string) { }

  /**
   * Scan for skills in the skills directory
   */
  async loadAll(): Promise<void> {
    try {
      const entries = await fs.readdir(this.skillsRoot, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      for (const dirName of dirs) {
        await this.loadSkill(dirName);
      }
    } catch (error) {
      console.warn(`[SkillRegistry] Failed to scan skills at ${this.skillsRoot}:`, error);
    }
  }

  /**
   * Load a specific skill by directory name
   */
  async loadSkill(dirName: string): Promise<Skill | undefined> {
    const skillDir = path.join(this.skillsRoot, dirName);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    try {
      // Check if SKILL.md exists
      try {
        await fs.access(skillMdPath);
      } catch {
        return undefined; // Not a skill
      }

      // Read SKILL.md
      const content = await fs.readFile(skillMdPath, "utf8");

      // Parse frontmatter
      // Simple parse: split by ---
      const parts = content.split(/^---$/m);
      if (parts.length < 3) {
        console.warn(`[SkillRegistry] Invalid SKILL.md format in ${dirName}`);
        return undefined;
      }

      const frontmatter = parts[1];
      const instructions = parts.slice(2).join("---").trim();

      const metadata = yaml.parse(frontmatter);
      const id = metadata.name || dirName;

      const skill: Skill = {
        id,
        metadata: {
          name: id,
          description: metadata.description || "",
          ...metadata
        },
        instructions,
        dir: skillDir,
      };

      this.skills.set(id, skill);
      return skill;

    } catch (error) {
      console.error(`[SkillRegistry] Failed to load skill ${dirName}:`, error);
      return undefined;
    }
  }

  /**
   * Get tools for a specific skill (lazy load module)
   */
  async getTools(skillId: string, config?: any): Promise<Record<string, CoreTool>> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    if (this.loadedTools.has(skillId)) {
      return this.loadedTools.get(skillId)!;
    }

    // Import index.ts
    const idxPath = path.join(skill.dir, "index.ts"); // or .js
    try {
      // Dynamic import
      // Note: In strict ESM/TS environments we might need full path or file URL
      const modulePath = path.resolve(idxPath);
      const mod = await import(modulePath) as SkillModule;

      let tools: Record<string, CoreTool> = {};

      if (mod.getTools) {
        tools = await mod.getTools(config);
      } else if (mod.tools) {
        tools = mod.tools;
      }

      this.loadedTools.set(skillId, tools);
      return tools;
    } catch (error) {
      console.error(`[SkillRegistry] Failed to load tools for ${skillId}:`, error);
      return {};
    }
  }

  /**
   * Pre-register tools for a skill (used for bundled builds where dynamic import of .ts fails)
   */
  preRegisterTools(skillId: string, tools: Record<string, CoreTool>): void {
    this.loadedTools.set(skillId, tools);
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}

import { fileURLToPath } from "url";
import { getViberRoot } from "../../config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple paths for skill discovery:
// 1. process.cwd() + src/skills (CLI run from project root) - Most common case
// 2. Relative to this file (works in dev mode with tsx)
// 3. Viber storage root (for daemon mode)
function getDefaultSkillsPath(): string {
  // Option 1: Check process.cwd() + src/skills (CLI run from project root)
  const cwdPath = path.resolve(process.cwd(), "src/skills");
  try {
    fsSync.accessSync(cwdPath);
    console.log(`[SkillRegistry] Using skills path (cwd): ${cwdPath}`);
    return cwdPath;
  } catch {
    // Option 2: Relative to this file (e.g., dist/core/skills -> dist/skills or src/core/skills -> src/skills)
    const relativePath = path.resolve(__dirname, "../../skills");
    try {
      fsSync.accessSync(relativePath);
      console.log(`[SkillRegistry] Using skills path (relative): ${relativePath}`);
      return relativePath;
    } catch {
      // Fallback to Viber storage root (for daemon mode)
      const viberPath = path.join(getViberRoot(), "skills");
      console.log(`[SkillRegistry] Using skills path (viber root): ${viberPath}`);
      return viberPath;
    }
  }
}

export const defaultRegistry = new SkillRegistry(getDefaultSkillsPath());

