export const prerender = false;

// Tool definitions for the agent
const tools = [
  {
    type: "function",
    function: {
      name: "create_artifact",
      description: "Create a file artifact in the workspace. Use this when the user asks you to write, create, or draft any document, code, or content. The user can see and download these files.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Name of the file to create (e.g., 'report.md', 'analysis.ts', 'notes.txt')"
          },
          content: {
            type: "string",
            description: "The full content of the file"
          },
          file_type: {
            type: "string",
            enum: ["markdown", "code", "text"],
            description: "Type of file: 'markdown' for .md files, 'code' for source code, 'text' for plain text"
          }
        },
        required: ["filename", "content", "file_type"]
      }
    }
  }
];

const systemPrompt = `You are a helpful AI assistant in the Viber Playground. You help users with research, writing, analysis, and coding tasks.

IMPORTANT: When users ask you to create, write, draft, or produce any content (documents, code, reports, etc.), you MUST use the create_artifact tool to save it to their workspace. This allows them to view, edit, and download the files.

Examples of when to use create_artifact:
- "Write a product requirements document" → create product-requirements.md
- "Draft an email" → create email-draft.md
- "Create a Python script" → create script.py
- "Analyze this data and write a report" → create analysis-report.md

Always use descriptive filenames and save meaningful content to artifacts.`;

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isStreaming = body.stream === true;

  try {
    // Add system prompt and tools to the request
    const enhancedBody = {
      ...body,
      messages: [
        { role: "system", content: systemPrompt },
        ...body.messages
      ],
      tools,
      tool_choice: "auto",
      stream: isStreaming
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://viber.ai",
        "X-Title": "Viber Playground",
      },
      body: JSON.stringify(enhancedBody),
    });

    if (isStreaming) {
      // Pass through the SSE stream
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
