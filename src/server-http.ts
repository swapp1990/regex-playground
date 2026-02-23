#!/usr/bin/env node

// HTTP server entry point for Regex Playground MCP
// Serves MCP tools + MCP App View over Streamable HTTP transport

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { createServer } from "http";
import { handleTestRegex } from "./tools/test-regex.js";
import { handleExplainRegex } from "./tools/explain-regex.js";
import { handleCommonPatterns } from "./tools/common-patterns.js";
import { handleGenerateRegex } from "./tools/generate-regex.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const RESOURCE_URI = "ui://regexplayground/view.html";
const PORT = parseInt(process.env.PORT || "8008", 10);

// Load the Vite-bundled View HTML
const __dirname = dirname(fileURLToPath(import.meta.url));
const viewHtml = readFileSync(join(__dirname, "../dist/mcp-app.html"), "utf-8");

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "regex-playground",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "test_regex",
    {
      title: "Test Regex",
      description:
        "Test a regex pattern against a test string. Returns all matches with indices and capture groups. Use when a user wants to test, try, or check a regex pattern.",
      inputSchema: {
        pattern: z.string().describe("The regex pattern (without delimiters)"),
        flags: z.string().optional().describe("Regex flags (e.g., 'gi', 'gm'). Default: no flags."),
        test_string: z.string().describe("The string to test the pattern against"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
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

  registerAppTool(
    server,
    "explain_regex",
    {
      title: "Explain Regex",
      description:
        "Explain a regex pattern by breaking it into annotated tokens with human-readable descriptions. Use when a user wants to understand, explain, or break down a regex.",
      inputSchema: {
        pattern: z.string().describe("The regex pattern to explain (without delimiters)"),
        flags: z.string().optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
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

  registerAppTool(
    server,
    "common_patterns",
    {
      title: "Common Patterns",
      description:
        "Browse a catalog of ~25 common regex patterns organized by category. Use when a user asks for common patterns, regex examples, a cheatsheet, or wants to find a regex for a common use case.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter by category: Validation, Extraction, Formatting, Web, Numbers, or All"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
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

  registerAppTool(
    server,
    "generate_regex",
    {
      title: "Generate Regex",
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
      _meta: { ui: { resourceUri: RESOURCE_URI } },
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

  registerAppResource(
    server,
    "Regex Playground View",
    RESOURCE_URI,
    {
      description: "Interactive regex testing interface",
      mimeType: RESOURCE_MIME_TYPE,
    },
    async () => ({
      contents: [{
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: viewHtml,
      }],
    })
  );

  return server;
}

async function main() {
  console.error("Regex Playground MCP HTTP Server starting...");

  const httpServer = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Accept");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "regex-playground" }));
      return;
    }

    // Browser GET → landing page
    if ((req.url === "/mcp" || req.url === "/") && req.method === "GET") {
      const accept = req.headers.accept || "";
      if (!accept.includes("text/event-stream")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>Regex Playground MCP</title></head><body>
<h1>Regex Playground MCP Server</h1>
<p>Interactive regex testing right inside your AI chat.</p>
<p>This is an MCP endpoint. Connect via:</p>
<pre>URL: https://regex.swapp1990.org/mcp</pre>
<p><a href="/health">Health check</a></p>
</body></html>`);
        return;
      }
    }

    // MCP endpoint — new server+transport per request (stateless mode)
    if (req.url === "/mcp" || req.url === "/") {
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        console.error("MCP request error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }

      res.on("close", () => {
        transport.close().catch(() => {});
        mcpServer.close().catch(() => {});
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(PORT, () => {
    console.error(`Regex Playground MCP HTTP Server running on http://localhost:${PORT}/mcp`);
    console.error(`Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
