import { CoreTool } from "../tool";

export interface SkillMetadata {
  name: string;
  description: string;
  [key: string]: any;
}

export interface Skill {
  id: string; // Directory name or name from SKILL.md
  metadata: SkillMetadata;
  instructions: string; // Markdown content from SKILL.md
  dir: string; // Directory path
}

export interface SkillModule {
  getTools?: (config?: any) => Promise<Record<string, CoreTool>> | Record<string, CoreTool>;
  tools?: Record<string, CoreTool>;
}
