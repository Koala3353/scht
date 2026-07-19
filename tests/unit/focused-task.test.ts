import { describe, expect, it } from "vitest";

import { focusedTaskId, mergeFocusedTask } from "../../lib/tasks/focused-task";

describe("focused task URL query", () => {
  it("accepts only one UUID task id", () => {
    const taskId = "f11c73a2-24b7-40ee-88fd-d7bf9a203420";

    expect(focusedTaskId(taskId)).toBe(taskId);
    expect(focusedTaskId("<script>alert(1)</script>")).toBeNull();
    expect(focusedTaskId([taskId, taskId])).toBeNull();
  });

  it("merges a focused task outside the normal 200-row planner window exactly once", () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({ id: `row-${index}` }));
    const focused = { id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420" };

    expect(mergeFocusedTask(rows, focused)).toEqual([...rows, focused]);
    expect(mergeFocusedTask([...rows, focused], focused)).toHaveLength(201);
  });
});
