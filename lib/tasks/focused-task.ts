import { z } from "zod";

const taskIdQuery = z.string().uuid();

export function focusedTaskId(value: string | string[] | undefined) {
  return typeof value === "string" && taskIdQuery.safeParse(value).success ? value : null;
}
