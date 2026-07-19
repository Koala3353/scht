type Invite = {
  id: string;
  email: string;
  role: "member" | "owner_admin";
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function inviteStatus(invite: Invite) {
  if (invite.accepted_at)
    return { label: "Accepted", tone: "bg-[#e6f2f0] text-teal" };
  if (invite.expires_at && new Date(invite.expires_at) <= new Date())
    return { label: "Expired", tone: "bg-red-50 text-red-800" };
  return { label: "Awaiting sign-in", tone: "bg-[#e8eef9] text-[#345d9d]" };
}

export function InviteOverview({ invites }: { invites: Invite[] }) {
  return (
    <section
      aria-labelledby="invite-overview-heading"
      className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-[.14em] text-teal">
            ACCESS OVERVIEW
          </p>
          <h2
            className="mt-2 text-xl font-bold tracking-tight text-slate-950"
            id="invite-overview-heading"
          >
            Recent account invitations
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            A lightweight view of account access without opening individual
            student workspaces.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          Latest {invites.length}
        </span>
      </div>

      {invites.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
          No invitations yet. Add the first account from the access panel above.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100">
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <li
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                key={invite.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-950">
                    {invite.email}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {invite.role === "owner_admin"
                      ? "Owner admin"
                      : "Student member"}
                    {invite.expires_at
                      ? ` · Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(invite.expires_at))}`
                      : " · No expiry"}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${status.tone}`}
                >
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
