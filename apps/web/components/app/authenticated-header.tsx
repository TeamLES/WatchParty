import Link from "next/link";
import { MonitorPlayIcon } from "lucide-react";

import { getCurrentUserFromApi } from "@/lib/auth";

import { AuthenticatedUserMenu } from "./authenticated-user-menu";

function toInitials(label: string | null): string {
  if (!label) {
    return "WP";
  }

  const cleaned = label.trim();

  if (!cleaned) {
    return "WP";
  }

  const parts = cleaned
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "WP";
  }

  return parts
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export async function AuthenticatedHeader() {
  const currentUser = await getCurrentUserFromApi();
  const userLabel = currentUser?.username ?? currentUser?.sub ?? null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/35 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/hub" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_20px_rgba(168,85,247,0.25)] transition group-hover:scale-[1.02] group-hover:bg-primary/20">
            <MonitorPlayIcon className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">WatchParty</p>
            <p className="text-[11px] text-muted-foreground">Synchronized cinema</p>
          </div>
        </Link>

        <AuthenticatedUserMenu
          userLabel={userLabel}
          initials={toInitials(userLabel)}
        />
      </div>
    </header>
  );
}
