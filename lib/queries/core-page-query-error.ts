export class CorePageQueryError extends Error {
  constructor(query: string) {
    super(`Core page query failed: ${query}`);
    this.name = "CorePageQueryError";
  }
}

export function requireQuery<T>(
  result: { data: T; error: unknown },
  query: string,
): T {
  if (result.error) throw new CorePageQueryError(query);
  return result.data;
}
