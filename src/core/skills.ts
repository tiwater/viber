import { Skill } from "./skill";

class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * Register a new skill
   */
  register(skill: Skill) {
    if (this.skills.has(skill.name)) {
      console.warn(`[SkillRegistry] Overwriting existing skill: ${skill.name}`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Clear registry (useful for testing)
   */
  clear() {
    this.skills.clear();
  }
}

// Singleton instance
export const skillRegistry = new SkillRegistry();
