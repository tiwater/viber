import { z } from "zod";

/**
 * Definition of a single tool within a skill
 */
export interface SkillTool<T = any> {
  description: string;
  parameters: z.ZodSchema<T>;
  execute: (args: T, context?: any) => Promise<any>;
}

/**
 * Definition of a Skill
 * A Skill is a logical grouping of tools that provide related functionality.
 * Inspired by clawdbot's skill system.
 */
export interface Skill {
  name: string;
  description: string;
  version?: string;
  tools: Record<string, SkillTool>;
}
