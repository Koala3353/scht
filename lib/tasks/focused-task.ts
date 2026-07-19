import { z } from "zod";

const taskIdQuery = z.string().uuid();

export function focusedTaskId(value: string | string[] | undefined) {
  return typeof value === "string" && taskIdQuery.safeParse(value).success ? value : null;
}

export function mergeFocusedTask<T extends { id: string }>(rows: T[], focused: T | null) {
  return focused && !rows.some((row) => row.id === focused.id) ? [...rows, focused] : rows;
}
