"use client";

import { useId, useState } from "react";

const connections = [
  {
    id: "calendar",
    label: "Google Calendar",
    eyebrow: "GOOGLE CALENDAR",
    heading: "Your schedule, beside the work it affects.",
    description:
      "Bring upcoming Google Calendar events into Scht’s time-ordered calendar without turning your workspace into another calendar app.",
    details: [
      [
        "Import on demand",
        "Choose when to sync upcoming events instead of handing over a constantly moving feed.",
      ],
      [
        "One clear timeline",
        "Imported events appear with your deadlines and planner tasks in one chronological view.",
      ],
      [
        "Keep the source close",
        "Open an imported event in Google Calendar whenever you need the original details.",
      ],
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    eyebrow: "GMAIL",
    heading: "Let important messages become visible work.",
    description:
      "Scht turns unread Gmail messages into deduplicated review tasks, so course updates can enter your plan without clogging it with an inbox clone.",
    details: [
      [
        "Unread-message review",
        "Bring in unread message subjects as tasks you can sort and complete on your own terms.",
      ],
      [
        "No duplicate clutter",
        "Repeated syncs recognize previously imported messages instead of creating the same task twice.",
      ],
      [
        "A planner, not an inbox",
        "Only the context you need lands in Scht; Gmail remains the place for full conversations.",
      ],
    ],
  },
  {
    id: "canvas",
    label: "Canvas",
    eyebrow: "CANVAS",
    heading: "Assignments arrive with their course context intact.",
    description:
      "Connect your own Canvas account to sync active courses and assignments into the academic term you are already planning.",
    details: [
      [
        "Term-aware import",
        "Canvas courses are matched to your selected academic term before assignments become tasks.",
      ],
      [
        "Assignments you can act on",
        "Due dates and course context travel with the assignment, ready for your planner and calendar.",
      ],
      [
        "Protected connection",
        "Your personal Canvas token is encrypted before it is stored and used only for the connection you set up.",
      ],
    ],
  },
  {
    id: "ai-vault",
    label: "Private AI vault",
    eyebrow: "PRIVATE AI VAULT",
    heading: "Useful AI, kept behind your own passphrase.",
    description:
      "Save an OpenAI or Hack Club AI key in a browser-encrypted vault, then use it only when you want a structured planning proposal.",
    details: [
      [
        "Encrypted before storage",
        "Your key is encrypted in the browser with your passphrase before it is saved to the workspace.",
      ],
      [
        "Proposal, not autopilot",
        "AI returns a reviewable task proposal; nothing changes in your planner until you explicitly apply it.",
      ],
      [
        "Bring your provider",
        "Use an OpenAI-compatible key or Hack Club AI, then unlock it only for the session where you need help.",
      ],
    ],
  },
  {
    id: "reminders",
    label: "Apps Script reminders",
    eyebrow: "APPS SCRIPT REMINDERS",
    heading: "A prompt at the right time—not another interruption.",
    description:
      "Use the optional Google Apps Script companion to send scheduled task reminders with your own time zone and quiet hours respected.",
    details: [
      [
        "Schedule with intent",
        "Choose which due-dated tasks deserve a reminder instead of alerting on every single deadline.",
      ],
      [
        "Quiet hours included",
        "Your reminder preferences keep delivery out of the hours you reserve for rest.",
      ],
      [
        "Your Apps Script, your control",
        "A protected dispatch endpoint gives your own Apps Script project the jobs to send and records the result.",
      ],
    ],
  },
] as const;

type ConnectionId = (typeof connections)[number]["id"];

export function ConnectionFeatureSwitcher() {
  const [selectedId, setSelectedId] = useState<ConnectionId>(connections[0].id);
  const panelId = useId();
  const selected =
    connections.find((connection) => connection.id === selectedId) ??
    connections[0];

  return (
    <div className="mt-10">
      <div
        aria-label="Connection features"
        className="flex flex-wrap gap-3"
        role="tablist"
      >
        {connections.map((connection) => {
          const isSelected = connection.id === selected.id;
          return (
            <button
              aria-controls={panelId}
              aria-selected={isSelected}
              className={`rounded-full border px-4 py-2 font-bold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                isSelected
                  ? "border-teal bg-teal text-white shadow-teal/20"
                  : "border-transparent bg-white text-ink hover:border-teal/30 hover:bg-[#f7fbfa]"
              }`}
              key={connection.id}
              onClick={() => setSelectedId(connection.id)}
              role="tab"
              type="button"
            >
              {connection.label}
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="mt-8 rounded-2xl border border-white/80 bg-white/65 p-5 shadow-sm sm:p-6"
        id={panelId}
        role="tabpanel"
      >
        <p className="text-xs font-black tracking-[0.16em] text-[#345d9d]">
          {selected.eyebrow}
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <h3 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              {selected.heading}
            </h3>
          </div>
          <p className="max-w-xl leading-7 text-slate-700">
            {selected.description}
          </p>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {selected.details.map(([title, description], index) => (
            <article
              className={[
                "border-t-2 pt-4",
                index === 0
                  ? "border-teal"
                  : index === 1
                    ? "border-[#345d9d]"
                    : "border-action",
              ].join(" ")}
              key={title}
            >
              <p className="font-black">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
