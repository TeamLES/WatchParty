import Link from "next/link";
import {
  CheckCircle2Icon,
  LogOutIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersRoundIcon,
  VideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUserFromApi } from "@/lib/auth";
import { getAccessTokenFromCookies } from "@/lib/cookies";

const floatingTiles = [
  {
    title: "12 watching",
    detail: "Lo-fi Beats",
    icon: VideoIcon,
    className:
      "left-[5%] top-[15%] sm:left-[10%] sm:top-[20%] lg:left-[15%] lg:top-[25%] animate-[float_6s_ease-in-out_infinite] rotate-[-6deg]",
  },
  {
    title: "89 messages",
    detail: "Live chat",
    icon: MessageSquareTextIcon,
    className:
      "right-[5%] top-[25%] sm:right-[10%] sm:top-[30%] lg:right-[15%] lg:top-[35%] animate-[float_7s_ease-in-out_infinite_0.4s] rotate-[4deg]",
  },
  {
    title: "Perfect sync",
    detail: "0.2s drift",
    icon: MonitorPlayIcon,
    className:
      "left-[10%] top-[40%] sm:left-[8%] sm:top-[50%] lg:left-[12%] lg:top-[60%] animate-[float_6.5s_ease-in-out_infinite_0.25s] rotate-[2deg]",
  },
  {
    title: "Secure",
    detail: "Private room",
    icon: ShieldCheckIcon,
    className:
      "right-[10%] top-[45%] sm:right-[15%] sm:top-[55%] lg:right-[18%] lg:top-[65%] animate-[float_8s_ease-in-out_infinite_0.6s] rotate-[-3deg]",
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
  const isAuthenticated = Boolean(accessToken);
  const currentUser = isAuthenticated ? await getCurrentUserFromApi() : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.1),transparent_45%)] px-6 py-20 flex flex-col items-center justify-center">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px] opacity-50 pointer-events-none" />

      {/* Floating Elements Layer */}
      <div className="absolute inset-0 z-0 hidden w-full h-full sm:block pointer-events-none">
        {floatingTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.title}
              className={`absolute glass-card rounded-2xl w-44 p-3 ${tile.className}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{tile.title}</p>
                  <p className="text-xs text-muted-foreground">{tile.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center space-y-8">
        <Badge variant="outline" className="glass-card gap-2 py-1.5 px-4 text-sm font-medium border-primary/30 text-primary">
          <SparklesIcon className="size-4" />
          WatchParty is now in beta
        </Badge>

        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          Watch together. <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-primary bg-clip-text text-transparent drop-shadow-sm">
            Feel together.
          </span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl md:text-2xl font-medium">
          The ultimate synchronized viewing experience. Share a link, press play, and enjoy perfect sync with live chat.
        </p>

        <p className="text-sm font-medium text-muted-foreground">
          {isAuthenticated
            ? "Session active. Jump into your room or safely log out."
            : "Sign in to create or join a synchronized room."}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full shadow-[0_0_30px_rgba(232,121,249,0.3)] hover:shadow-[0_0_40px_rgba(232,121,249,0.5)] transition-all">
                <Link href="/room" className="gap-2">
                  <MonitorPlayIcon className="size-5" />
                  Go to room
                </Link>
              </Button>
              <Button asChild size="lg" variant="destructive" className="h-14 px-8 text-lg rounded-full transition-all">
                <Link href="/logout" className="gap-2">
                  <LogOutIcon className="size-5" />
                  Logout
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full shadow-[0_0_30px_rgba(232,121,249,0.3)] hover:shadow-[0_0_40px_rgba(232,121,249,0.5)] transition-all">
              <Link href="/auth/login" className="gap-2">
                <MonitorPlayIcon className="size-5" />
                Login
              </Link>
            </Button>
          )}
          <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg rounded-full glass-card hover:bg-white/10 transition-all">
            <a href="/api/me" className="gap-2">
              <UserRoundIcon className="size-5" />
              API status
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-primary" /> No installs
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-primary" /> Free forever
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-primary" /> HD Video
          </span>
        </div>

        {/* User Card (Rendered only if logged in) */}
        {currentUser && (
          <div className="w-full max-w-md pt-8">
            <Card className="glass-card border-primary/20">
              <CardContent className="flex flex-col gap-2 p-5 text-sm text-left">
                <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                  <ShieldCheckIcon className="size-5" />
                  Authenticated Session Active
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-1 text-muted-foreground">
                  <span className="font-medium text-foreground">Sub:</span>
                  <span className="truncate">{currentUser.sub}</span>
                  <span className="font-medium text-foreground">User:</span>
                  <span className="truncate">{currentUser.username ?? "(not in token)"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Feature Grid */}
      <section className="relative z-10 mx-auto mt-32 grid w-full max-w-5xl gap-6 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Icon className="size-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">{feature.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
