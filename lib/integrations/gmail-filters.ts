export type GmailTaskFilters = {
  taskTriggers: string[];
  excludedPhrases: string[];
};

export const DEFAULT_GMAIL_TASK_FILTERS: GmailTaskFilters = {
  taskTriggers: [
    "assignment",
    "assessment",
    "quiz",
    "exam",
    "deadline",
    "due",
    "homework",
    "class",
    "course",
    "canvas",
    "submission",
    "syllabus",
    "grade",
  ],
  excludedPhrases: ["sale", "discount", "promotion", "promo", "newsletter", "unsubscribe"],
};

function phrases(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 30);
  return cleaned.length ? cleaned : fallback;
}

export function gmailTaskFilters(value: unknown): GmailTaskFilters {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    taskTriggers: phrases(record.taskTriggers, DEFAULT_GMAIL_TASK_FILTERS.taskTriggers),
    excludedPhrases: phrases(record.excludedPhrases, DEFAULT_GMAIL_TASK_FILTERS.excludedPhrases),
  };
}

export function messageMatchesGmailTaskFilters(
  message: { snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } },
  filters: GmailTaskFilters,
) {
  const headers = message.payload?.headers ?? [];
  const searchable = [
    message.snippet,
    ...headers
      .filter((header) => header.name.toLowerCase() === "subject" || header.name.toLowerCase() === "from")
      .map((header) => header.value),
  ].filter(Boolean).join(" ").toLowerCase();
  return filters.taskTriggers.some((phrase) => searchable.includes(phrase))
    && !filters.excludedPhrases.some((phrase) => searchable.includes(phrase));
}

export function gmailTaskListQuery() {
  return "in:inbox is:unread -category:promotions -category:social -category:updates -label:spam -label:trash";
}
