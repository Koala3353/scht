import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const reset = readFileSync(
  path.resolve(testDirectory, "../../supabase/master_reset.sql"),
  "utf8",
).toLowerCase();
const googleSync = readFileSync(
  path.resolve(testDirectory, "../../app/api/integrations/google/sync/route.ts"),
  "utf8",
);

describe("master reset schema contract", () => {
  it("is an explicitly destructive, transactional fresh-deployment reset", () => {
    expect(reset.trimStart().startsWith("begin;")).toBe(true);
    expect(reset.trimEnd().endsWith("commit;")).toBe(true);
    expect(reset).toContain("raise warning");
    expect(reset).toContain("destructive");
    expect(reset).toContain("drop schema public cascade");
    expect(reset).toContain("create schema public");
    expect(reset).not.toContain("delete from storage.objects");
    expect(reset).toContain("bucket_id = 'syllabi'");
    expect(reset).toContain("the syllabi bucket is not empty");
  });

  it("recreates the compact Scht model with user isolation and supporting indexes", () => {
    for (const table of [
      "profiles",
      "invites",
      "academic_terms",
      "subjects",
      "curriculum_items",
      "tasks",
      "projects",
      "syllabi",
      "grade_categories",
      "assessment_results",
      "calendar_events",
      "integration_connections",
      "encrypted_ai_vaults",
      "reminder_preferences",
      "reminder_queue",
      "reminder_deliveries",
      "email_digest_deliveries",
      "sync_errors",
      "admin_audit_logs",
    ]) {
      expect(reset).toContain(`create table public.${table}`);
      expect(reset).toContain(`alter table public.${table} enable row level security`);
    }

    for (const index of [
      "tasks_user_due_at_idx",
      "subjects_user_term_idx",
      "tasks_user_source_source_id_key",
      "calendar_events_user_starts_at_idx",
      "reminder_queue_user_status_send_at_idx",
    ]) {
      expect(reset).toContain(index);
    }
  });

  it("keeps syllabi private and makes owner bootstrap single-use", () => {
    expect(reset).toContain("insert into storage.buckets");
    expect(reset).toContain("'syllabi'");
    expect(reset).toMatch(/values\s*\('syllabi',\s*'syllabi',\s*false\)/);
    expect(reset).toContain("create table private.bootstrap_owner");
    expect(reset).toContain("delete from private.bootstrap_owner");
    expect(reset).toContain("owner_admin");
    expect(reset).toContain("create trigger on_auth_user_created");
  });

  it("restores server-only service-role privileges after rebuilding public", () => {
    expect(reset).toContain(
      "grant select, insert, update, delete on all tables in schema public to authenticated;",
    );
    expect(reset).toContain(
      "grant usage, select on all sequences in schema public to authenticated;",
    );
    expect(reset).toContain(
      "grant all privileges on all tables in schema public to service_role;",
    );
    expect(reset).toContain(
      "grant all privileges on all sequences in schema public to service_role;",
    );
    expect(reset).toContain(
      "grant execute on all functions in schema public to service_role;",
    );
  });

  it("does not restore discarded data or plaintext provider credentials", () => {
    for (const forbidden of [
      "raw jsonb",
      "create table public.notes",
      "create table public.ai_conversations",
      "create table public.global_settings",
      "create table public.feature_flags",
      "provider_token",
      "access_token",
      "refresh_token",
    ]) {
      expect(reset).not.toContain(forbidden);
    }
  });

  it("stores only normalized calendar fields, never a provider payload", () => {
    expect(googleSync).toContain('from("calendar_events").upsert(events');
    expect(googleSync).not.toMatch(/\braw\s*:/);
  });
});
