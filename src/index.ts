#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleTestRegex } from "./tools/test-regex.js";
import { handleExplainRegex } from "./tools/explain-regex.js";
import { handleCommonPatterns } from "./tools/common-patterns.js";
import { handleGenerateRegex } from "./tools/generate-regex.js";

const server = new McpServer({
  name: "regex-playground",
  version: "0.1.0",
});

server.registerTool(
  "test_regex",
  {
    description:
      "Test a regex pattern against a test string. Returns all matches with indices and capture groups. Use when a user wants to test, try, or check a regex pattern.",
    inputSchema: {
      pattern: z.string().describe("The regex pattern (without delimiters)"),
      flags: z.string().optional().describe("Regex flags (e.g., 'gi', 'gm'). Default: no flags."),
      test_string: z.string().describe("The string to test the pattern against"),
    },
  },
  async ({ pattern, flags, test_string }) => {
    const result = handleTestRegex({ pattern, flags, test_string });
    return {
      content: [
        { type: "text", text: result.text },
        { type: "text", text: JSON.stringify(result.json) },
      ],
    };
  }
);

server.registerTool(
  "explain_regex",
  {
    description:
      "Explain a regex pattern by breaking it into annotated tokens with human-readable descriptions. Use when a user wants to understand, explain, or break down a regex.",
    inputSchema: {
      pattern: z.string().describe("The regex pattern to explain (without delimiters)"),
      flags: z.string().optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
    },
  },
  async ({ pattern, flags }) => {
    const result = handleExplainRegex({ pattern, flags });
    return {
      content: [
        { type: "text", text: result.text },
        { type: "text", text: JSON.stringify(result.json) },
      ],
    };
  }
);

server.registerTool(
  "common_patterns",
  {
    description:
      "Browse a catalog of ~25 common regex patterns organized by category (Validation, Extraction, Formatting, Web, Numbers). Use when a user asks for common patterns, regex examples, a cheatsheet, or wants to find a regex for a common use case.",
    inputSchema: {
      category: z
        .string()
        .optional()
        .describe("Filter by category: Validation, Extraction, Formatting, Web, Numbers, or All"),
    },
  },
  async ({ category }) => {
    const result = handleCommonPatterns({ category });
    return {
      content: [
        { type: "text", text: result.text },
        { type: "text", text: JSON.stringify(result.json) },
      ],
    };
  }
);

server.registerTool(
  "generate_regex",
  {
    description:
      "Validate a regex pattern against test cases (should-match and should-not-match). Use when a user asks to generate, create, or build a regex and wants to verify it works.",
    inputSchema: {
      pattern: z.string().describe("The regex pattern to validate"),
      flags: z.string().optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
      description: z.string().optional().describe("Human-readable description of what the regex should match"),
      test_cases: z
        .array(
          z.object({
            input: z.string().describe("Test string"),
            should_match: z.boolean().describe("Whether the pattern should match this string"),
          })
        )
        .describe("Array of test cases to validate the pattern against"),
    },
  },
  async ({ pattern, flags, description, test_cases }) => {
    const result = handleGenerateRegex({ pattern, flags, description, test_cases });
    return {
      content: [
        { type: "text", text: result.text },
        { type: "text", text: JSON.stringify(result.json) },
      ],
    };
  }
);

async function main() {
  console.error("Regex Playground MCP Server starting (stdio)...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Regex Playground MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
