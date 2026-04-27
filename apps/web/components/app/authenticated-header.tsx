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
    <header className="sticky top-0 z-50 border-b border-violet-300/45 bg-[linear-gradient(90deg,rgba(147,51,234,0.1),rgba(233,213,255,0.4),rgba(168,85,247,0.1))] shadow-[0_1px_0_rgba(124,58,237,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(90deg,rgba(88,28,135,0.25),rgba(147,51,234,0.2),rgba(88,28,135,0.25))] dark:shadow-none">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/hub"
          className="group flex items-center gap-2.5 sm:gap-3.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-[0_0_20px_rgba(168,85,247,0.25)] transition group-hover:scale-[1.02] group-hover:bg-primary/20 sm:h-10 sm:w-10 sm:rounded-xl">
            <MonitorPlayIcon className="size-4.5 sm:size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight sm:text-base">
              WatchParty
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Synchronized cinema
            </p>
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
