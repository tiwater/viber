import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// POST /api/chat - Proxy chat to OpenRouter or viber endpoint
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { viberId, messages, stream = true } = body;

    // viberId is reserved for future use when we want to route to specific vibers
    // For now, all chat goes through OpenRouter
    void viberId;

    // Fall back to OpenRouter API
    if (!OPENROUTER_API_KEY) {
      return json(
        {
          error: "OpenRouter API key not configured",
          message: "Set OPENROUTER_API_KEY environment variable to enable chat",
        },
        { status: 503 },
      );
    }

    const systemPrompt = `You are a helpful AI assistant in the Viber Cockpit. You help users understand and work with their Viber agents.`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://viber.dustland.ai",
        "X-Title": "Viber Cockpit",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: chatMessages,
        stream,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter error:", error);
      return json(
        { error: "Failed to get response from AI" },
        { status: response.status },
      );
    }

    if (stream) {
      // Return streaming response
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error("Chat error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
