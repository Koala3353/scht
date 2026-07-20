import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const callback = readFileSync(
  path.resolve(testDirectory, "../../app/auth/callback/route.ts"),
  "utf8",
);
const reset = readFileSync(
  path.resolve(testDirectory, "../../supabase/master_reset.sql"),
  "utf8",
);

describe("reset invite recovery contract", () => {
  it("checks an established profile before using the invite-recovery fallback", () => {
    expect(callback.indexOf("accept_invite_for_current_user")).toBeGreaterThan(-1);
    expect(callback.indexOf(".from('profiles')")).toBeLessThan(
      callback.indexOf("accept_invite_for_current_user"),
    );
    expect(callback).toContain("adminSupabase = createAdminClient()");
    expect(callback).toContain("admin-auth-diagnostic");
    expect(callback).toContain("if (!profile)");
    expect(callback).toContain("authFailurePath('workspace-access-check-failed')");
  });

  it("does not describe a failed server-side profile check as a missing invite", () => {
    const profileErrorBranch = callback.slice(
      callback.indexOf("if (profileError)"),
      callback.indexOf("if (!profile)"),
    );

    expect(profileErrorBranch).toContain("workspace-access-check-failed");
    expect(profileErrorBranch).not.toContain("invite-required");
  });

  it("provisions profiles only for the one-use owner bootstrap or a locked pending invite", () => {
    const newUserFunction = reset.slice(
      reset.indexOf("create or replace function public.handle_new_user()"),
      reset.indexOf("create or replace function public.prevent_profile_role_change()"),
    );
    const acceptInviteFunction = reset.slice(
      reset.indexOf("create or replace function public.accept_invite_for_current_user()"),
      reset.indexOf("grant execute on function public.has_available_invite"),
    );

    expect(newUserFunction).toContain("delete from private.bootstrap_owner");
    expect(newUserFunction).toContain("if coalesce(bootstrap_owner, false) then");
    expect(newUserFunction).not.toContain("else 'member'");
    expect(acceptInviteFunction).toContain("for update");
    expect(acceptInviteFunction).toContain("insert into public.profiles (id, role)");
    expect(acceptInviteFunction).toContain("values (auth.uid(), accepted_invite.role)");
    expect(acceptInviteFunction).toContain("set accepted_by = auth.uid()");
    expect(reset).toContain(
      "revoke all on function public.accept_invite_for_current_user() from public, anon;",
    );
    expect(reset).not.toContain('create policy "users insert own profile"');
  });

  it("recovers the configured bootstrap owner when their Supabase Auth account already existed before a reset", () => {
    const bootstrapRecovery = reset.slice(
      reset.indexOf("-- Recover the configured owner when Auth is preserved."),
      reset.indexOf("create or replace function public.prevent_profile_role_change()"),
    );

    expect(bootstrapRecovery).toContain("from auth.users as existing_auth_user");
    expect(bootstrapRecovery).toContain("'owner_admin'::public.profile_role");
    expect(bootstrapRecovery).toContain("delete from private.bootstrap_owner");
  });
});
