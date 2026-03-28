"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuthenticatedUserMenuProps = {
  userLabel: string | null;
  initials: string;
};

export function AuthenticatedUserMenu({
  userLabel,
  initials,
}: AuthenticatedUserMenuProps) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 rounded-full border border-white/10 bg-black/20 px-1.5 pr-2.5 backdrop-blur hover:bg-white/10"
        >
          <Avatar size="sm" className="ring-1 ring-white/10">
            <AvatarFallback className="bg-primary/20 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="ml-2 hidden max-w-28 truncate text-xs font-medium text-muted-foreground sm:block">
            {userLabel ?? "Account"}
          </span>
          <ChevronDownIcon className="ml-1 size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-56 border-white/10 bg-black/80 backdrop-blur-2xl"
      >
        {userLabel ? (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Signed in
            </DropdownMenuLabel>
            <DropdownMenuItem disabled className="opacity-100">
              <span className="truncate text-sm font-medium text-foreground">
                {userLabel}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={(nextTheme) => setTheme(nextTheme)}
        >
          <DropdownMenuRadioItem value="light" className="gap-2">
            <SunIcon className="size-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <MoonIcon className="size-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <MonitorIcon className="size-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild variant="destructive" className="gap-2">
          <Link href="/logout">
            <LogOutIcon className="size-4" />
            Logout
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
