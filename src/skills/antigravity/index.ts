import { z } from "zod";
import { BrowserCDP } from "../../tools/browser"; // Import the class directly if needed, or instantiate manually

/**
 * Domain Logic for Antigravity App
 * Encapsulates the specific DOM structure (iframes, selectors)
 */
export function getTools() {
  return {
    antigravity_check_status: {
      description: "Analyze the Antigravity IDE state to detect critical errors.",
      inputSchema: z.object({}),
      execute: async () => {
        const cdp = new BrowserCDP();
        const targets = await cdp.listTargets();
        const page = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome'));

        if (!page) {
          return { status: "UNKNOWN", message: "No active browser page found." };
        }

        // Inject the specific JS to find the iframe and error
        const result = await cdp.evaluate(page, `
              (function() {
                // First check iframe (where Antigravity chat panel lives)
                const iframe = document.querySelector('iframe[src*="antigravity"]');
                const iframeDoc = iframe && iframe.contentDocument;
                const searchDoc = iframeDoc || document;
                const searchText = (iframeDoc ? iframeDoc.body?.innerText : document.body?.innerText) || '';
                
                // Check for error by text content
                const hasError = searchText.includes('Agent terminated due to error');
                
                // Look for Retry button in the same context
                let retryBtn = null;
                if (hasError) {
                  const buttons = searchDoc.querySelectorAll('button');
                  retryBtn = Array.from(buttons).find(
                    b => b.textContent.trim() === 'Retry'
                  );
                }
                
                return {
                  hasError: !!hasError,
                  hasRetryButton: !!retryBtn,
                  iframeFound: !!iframe
                };
              })()
        `);

        if (result?.hasError) {
          return {
            status: "CRITICAL_ERROR",
            details: "Agent terminated due to error",
            canRecover: result.hasRetryButton
          };
        }

        return { status: "NOMINAL", details: "System healthy" };
      },
    },

    antigravity_recover: {
      description: "Attempt to recover the Antigravity agent from a critical error.",
      inputSchema: z.object({}),
      execute: async () => {
        const cdp = new BrowserCDP();
        const targets = await cdp.listTargets();
        const page = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome'));

        if (!page) return { success: false, message: "No page found" };

        // Click Logic specifically searching inside the iframe
        const clicked = await cdp.evaluate(page, `
              (function() {
                const iframe = document.querySelector('iframe[src*="antigravity"]');
                const searchDoc = (iframe && iframe.contentDocument) || document;
                
                const buttons = searchDoc.querySelectorAll('button');
                const retryBtn = Array.from(buttons).find(
                   b => b.textContent.trim() === 'Retry'
                );
                
                if (retryBtn) {
                   retryBtn.click();
                   return true;
                }
                return false;
              })()
        `);

        if (clicked) {
          return { success: true, message: "Clicked 'Retry' button inside Antigravity frame." };
        }
        return { success: false, message: "Could not find 'Retry' button to click." };
      },
    }
  };
}
