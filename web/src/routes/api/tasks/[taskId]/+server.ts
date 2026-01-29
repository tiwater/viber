import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { hubClient } from "$lib/server/hub-client";

// GET /api/tasks/[taskId] - Get task status and result from hub
export const GET: RequestHandler = async ({ params }) => {
  try {
    const task = await hubClient.getTask(params.taskId);
    if (!task) {
      return json({ error: "Task not found" }, { status: 404 });
    }
    return json(task);
  } catch (error) {
    console.error("Failed to fetch task:", error);
    return json({ error: "Failed to fetch task" }, { status: 500 });
  }
};
