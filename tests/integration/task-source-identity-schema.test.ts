import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(path.resolve(testDirectory, "../../supabase/migrations/0013_task_source_identity.sql"), "utf8").toLowerCase();
const reset = readFileSync(path.resolve(testDirectory, "../../supabase/master_reset.sql"), "utf8").toLowerCase();
const canvasRoute = readFileSync(path.resolve(testDirectory, "../../app/api/integrations/canvas/route.ts"), "utf8");
const googleRoute = readFileSync(path.resolve(testDirectory, "../../app/api/integrations/google/sync/route.ts"), "utf8");

const sourceIdentity = "(user_id, source, source_id)";
const sourceIdentityIndex = /create\s+unique\s+index\s+tasks_user_source_source_id_key\s+on\s+public\.tasks\s+\(user_id,\s*source,\s*source_id\)/;

describe("task provider source identity schema", () => {
  it("upgrades the legacy partial identity index to a non-partial conflict target", () => {
    expect(migration).toContain("drop index if exists public.tasks_user_source_source_id_key");
    expect(migration).toMatch(sourceIdentityIndex);
    expect(migration).not.toMatch(/tasks_user_source_source_id_key[\s\S]*where\s+source_id\s+is\s+not\s+null/);
  });

  it("uses the same non-partial provider identity in the reset schema", () => {
    expect(reset).toContain(`create unique index tasks_user_source_source_id_key on public.tasks ${sourceIdentity}`);
    expect(reset).not.toMatch(/tasks_user_source_source_id_key[\s\S]*where\s+source_id\s+is\s+not\s+null/);
  });

  it("matches the provider routes' atomic conflict target", () => {
    for (const route of [canvasRoute, googleRoute]) {
      expect(route).toContain('onConflict: "user_id,source,source_id"');
      expect(route).toContain("ignoreDuplicates: true");
    }
  });
});
