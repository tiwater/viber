import { z } from "zod";
import { Skill } from "../core/skill";

export const calculatorSkill: Skill = {
  name: "calculator",
  description: "Basic arithmetic operations",
  version: "1.0.0",
  tools: {
    add: {
      description: "Add two numbers",
      parameters: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
      execute: async ({ a, b }) => {
        return a + b;
      },
    },
    subtract: {
      description: "Subtract second number from first number",
      parameters: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
      execute: async ({ a, b }) => {
        return a - b;
      },
    },
    multiply: {
      description: "Multiply two numbers",
      parameters: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
      execute: async ({ a, b }) => {
        return a * b;
      },
    },
    divide: {
      description: "Divide first number by second number",
      parameters: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
      execute: async ({ a, b }) => {
        if (b === 0) throw new Error("Cannot divide by zero");
        return a / b;
      },
    },
  },
};
