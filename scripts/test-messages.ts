#!/usr/bin/env node
/**
 * Test script for extracting messages from Antigravity windows via CDP
 */

import WebSocket from "ws";

const CDP_PORT = 9333;

interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  windowTitle: string;
}

async function extractMessages(wsUrl: string, windowTitle: string): Promise<ConversationMessage[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let messageId = 1;

    const timeout = setTimeout(() => {
      ws.close();
      resolve([]);
    }, 5000);

    ws.on("open", () => {
      // Query the Antigravity iframe for messages
      const script = `
        (function() {
          const iframe = document.querySelector('iframe[src*="antigravity"]');
          const iframeDoc = iframe && iframe.contentDocument;
          const reactApp = iframeDoc && iframeDoc.getElementById('react-app');
          if (!reactApp) return JSON.stringify({ messages: [] });

          const chatDiv = reactApp.querySelector('#chat');
          if (!chatDiv) return JSON.stringify({ messages: [] });

          // Get all divs and find message-like content
          const allDivs = chatDiv.querySelectorAll('div');
          const messages = [];
          const seenTexts = new Set();

          for (const div of allDivs) {
            const text = (div.innerText || '').trim();
            if (text.length > 30 && text.length < 5000 && !seenTexts.has(text)) {
              // Heuristic: assistant messages are longer or have code
              const hasCode = text.includes('\`\`\`') || div.querySelector('code, pre');
              const isAssistant = hasCode || text.length > 200;
              
              // Skip nested duplicates
              const parent = div.parentElement;
              if (parent && (parent.innerText || '').trim() === text) continue;
              
              seenTexts.add(text);
              messages.push({
                role: isAssistant ? 'assistant' : 'user',
                content: text.slice(0, 300)
              });
            }
          }

          return JSON.stringify({ messages: messages.slice(-5) });
        })()
      `;

      ws.send(JSON.stringify({
        id: messageId,
        method: "Runtime.evaluate",
        params: { expression: script, returnByValue: true }
      }));
    });

    ws.on("message", (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === messageId) {
        clearTimeout(timeout);
        ws.close();

        try {
          const result = JSON.parse(msg.result?.result?.value || '{"messages":[]}');
          const messages = (result.messages || []).map((m: any) => ({
            ...m,
            windowTitle
          }));
          resolve(messages);
        } catch {
          resolve([]);
        }
      }
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

async function main() {
  console.log(`Connecting to CDP on port ${CDP_PORT}...`);

  const res = await fetch(`http://localhost:${CDP_PORT}/json`);
  if (!res.ok) {
    console.error("CDP not available. Start Antigravity with --remote-debugging-port=9333");
    process.exit(1);
  }

  const targets: CDPTarget[] = await res.json();
  const agTargets = targets.filter(t =>
    t.type === "page" &&
    !t.url.startsWith("chrome://") &&
    !t.url.startsWith("chrome-extension://") &&
    t.url.includes("workbench")
  );

  console.log(`Found ${agTargets.length} Antigravity window(s)\n`);

  for (const target of agTargets) {
    if (!target.webSocketDebuggerUrl) continue;

    console.log(`📋 ${target.title}`);
    console.log("─".repeat(50));

    const messages = await extractMessages(target.webSocketDebuggerUrl, target.title);

    if (messages.length === 0) {
      console.log("  (no conversation found)");
    } else {
      for (const msg of messages) {
        const icon = msg.role === "user" ? "👤" : "🤖";
        const preview = msg.content.slice(0, 100).replace(/\n/g, " ");
        console.log(`  ${icon} ${preview}${msg.content.length > 100 ? "..." : ""}`);
      }
    }
    console.log();
  }
}

main().catch(console.error);
