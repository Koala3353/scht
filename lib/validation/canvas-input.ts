const localHosts = new Set(["localhost", "::1", "0.0.0.0"]);

export function normalizeCanvasBaseUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null;
    if (
      localHosts.has(url.hostname.toLowerCase()) ||
      /^127\./.test(url.hostname) ||
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname)
    )
      return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function validCanvasToken(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length >= 8 &&
    value.trim().length <= 4096
  );
}
