import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageSquareTextIcon,
  MonitorPlayIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAccessTokenFromCookies } from "@/lib/cookies";

const floatingTiles = [
  {
    title: "2.1K online",
    detail: "Active watchers",
    icon: UsersRoundIcon,
    className:
      "left-[6%] top-[16%] sm:left-[10%] sm:top-[22%] animate-[float_6.5s_ease-in-out_infinite] rotate-[-6deg]",
  },
  {
    title: "Perfect sync",
    detail: "Sub-second drift",
    icon: MonitorPlayIcon,
    className:
      "right-[7%] top-[26%] sm:right-[12%] sm:top-[34%] animate-[float_7s_ease-in-out_infinite_0.4s] rotate-[4deg]",
  },
  {
    title: "Live chat",
    detail: "Room reactions",
    icon: MessageSquareTextIcon,
    className:
      "left-[12%] top-[54%] sm:left-[16%] sm:top-[62%] animate-[float_8s_ease-in-out_infinite_0.25s] rotate-[2deg]",
  },
  {
    title: "Instant invites",
    detail: "Join in one click",
    icon: SparklesIcon,
    className:
      "right-[10%] top-[58%] sm:right-[14%] sm:top-[66%] animate-[float_7.4s_ease-in-out_infinite_0.5s] rotate-[-3deg]",
  },
];

const features = [
  {
    title: "Cinematic Sync",
    description: "Lightning-fast playback syncing feels like you're on the same couch.",
    icon: MonitorPlayIcon,
  },
  {
    title: "Instant Rooms",
    description: "One click to create. No downloads or setup required.",
    icon: UsersRoundIcon,
  },
  {
    title: "Real-time Chat",
    description: "Express yourself with built-in text chat while watching.",
    icon: MessageSquareTextIcon,
  },
];

export default async function Home() {
  const accessToken = await getAccessTokenFromCookies();

  if (accessToken) {
    redirect("/hub");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.22),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.2),transparent_38%),radial-gradient(circle_at_50%_95%,rgba(147,51,234,0.18),transparent_50%),linear-gradient(180deg,#09090b,#0f071a)] px-6 py-20 text-foreground">
      <div className="absolute left-1/2 top-1/3 -z-10 h-140 w-140 -translate-x-1/2 rounded-full bg-primary/25 blur-[130px]" />

      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {floatingTiles.map((tile) => {
          const Icon = tile.icon;

          return (
            <div key={tile.title} className={`absolute ${tile.className}`}>
              <div className="glass-card rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tile.title}</p>
                    <p className="text-xs text-muted-foreground">{tile.detail}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <Badge
          variant="outline"
          className="glass-card border-primary/35 bg-black/30 px-4 py-1.5 text-sm font-medium text-primary"
        >
          <SparklesIcon className="size-4" />
          WatchParty is now in beta
        </Badge>

        <h1 className="mt-8 text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
          Watch Together.
          <br className="hidden sm:block" />
          <span className="bg-linear-to-r from-primary via-fuchsia-300 to-violet-200 bg-clip-text text-transparent">
            Perfectly In Sync.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Create a room, invite friends, and enjoy a shared cinema moment with
          real-time chat and low-latency playback sync.
        </p>

        <div className="mt-10">
          <Link
            href="/auth/login"
            className="text-base font-semibold text-primary underline decoration-primary/70 underline-offset-6 transition-colors hover:text-primary/80"
          >
            Continue to Sign In
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary" /> No installs
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary" /> Live rooms
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary" /> Real-time chat
          </span>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-24 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card
              key={feature.title}
              className="glass-card border-white/10 bg-black/30 transition-transform duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-7">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                  <Icon className="size-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="text-base leading-relaxed text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
