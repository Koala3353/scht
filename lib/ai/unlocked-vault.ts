export type AiProvider = "openai" | "hackclub";

export const unlockedAiKeysStorageKey = "scht-unlocked-ai-keys";

export function unlockedAiKeys(): Partial<Record<AiProvider, string>> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(unlockedAiKeysStorageKey) ?? "{}") as Record<string, unknown>;
    return {
      ...(typeof parsed.openai === "string" ? { openai: parsed.openai } : {}),
      ...(typeof parsed.hackclub === "string" ? { hackclub: parsed.hackclub } : {}),
    };
  } catch {
    return {};
  }
}

export function unlockedAiKey(provider: AiProvider) {
  return unlockedAiKeys()[provider] ?? "";
}

export function saveUnlockedAiKeys(values: Partial<Record<AiProvider, string>>) {
  sessionStorage.setItem(unlockedAiKeysStorageKey, JSON.stringify(values));
}
