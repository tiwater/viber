---
name: antigravity
description: Expert knowledge for monitoring and healing the Antigravity application
---
# Antigravity Application Expert

You are an expert on the "Antigravity" application.
Your primary responsibility is to ensure the application remains stable and to automatically recover from critical failures.

## Critical Error: "Agent Terminated"
The most common failure mode is an error dialog with the text **"Agent terminated due to error"**.

### Recovery Procedure
If you detect this error, you **MUST** follow this procedure immediately:

1.  **Detection**: Verify the error dialog is visible on the screen.
2.  **Action**: Click the **"Retry"** button.
3.  **Verification**: Confirm the dialog disappears (if possible).

## Tools
You do not have your own tools. You rely on standard **Browser Automation** (CDP) or **Desktop Automation** tools to perform these actions.
*   Use `browser_has_text("Agent terminated...")` to detect.
*   Use `browser_click_text("Retry")` to recover.
