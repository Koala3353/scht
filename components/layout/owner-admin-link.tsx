import { ShieldCheck } from "lucide-react";

export function OwnerAdminLink() {
  return (
    <a
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-teal/25 bg-white px-3 text-sm font-bold text-teal transition hover:bg-teal/5 focus-visible:outline-teal"
      href="/admin"
    >
      <ShieldCheck aria-hidden="true" className="size-4" />
      Owner admin
    </a>
  );
}
