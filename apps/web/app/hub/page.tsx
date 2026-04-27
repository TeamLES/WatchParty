"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LockIcon,
  GlobeIcon,
  UsersRoundIcon,
  SearchIcon,
  MonitorPlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoomSummaryResponse } from "@watchparty/shared-types";

const extractYoutubeId = (url: string | null) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function HubPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummaryResponse[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as RoomSummaryResponse[];
        setRooms(data);
      } else {
        console.error("Failed to fetch rooms:", res.status);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();

    const intervalId = window.setInterval(() => {
      void fetchRooms();
    }, 8000);

    const handleWindowFocus = () => {
      void fetchRooms();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchRooms();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchRooms]);

  // Create Room Form State
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = rooms.filter((room) =>
    room.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: { title: string; isPrivate: boolean; password?: string } =
        {
          title,
          isPrivate,
        };

      if (isPrivate && password) {
        payload.password = password;
      }

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Failed to create room", res.status);
        return;
      }

        const data = await res.json();

        // By user requirement, ALWAYS ask for password, even for the host.
        // Bypassing directly to the room is removed.
        router.push(`/room/join/${data.roomId}`);
    } catch (error) {
      console.error("Failed to create room", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-surface min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.12),transparent_48%)] font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.18),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.16),transparent_50%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 p-4 pb-20 sm:p-8">
        {/* HERO CREATE SECTION */}
        <section className="glass-card relative flex flex-col items-center overflow-hidden rounded-[2rem] border-violet-300/45 bg-white/68 p-6 text-center shadow-2xl dark:border-white/10 dark:bg-card/60 sm:p-12">
          <div className="absolute top-1/2 left-1/2 -z-10 h-100 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />

          <Badge
            variant="outline"
            className="mb-6 gap-1 border-primary/35 bg-violet-50/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-black/25"
          >
            New Session
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground drop-shadow-md">
            Start a Watch Party
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl mb-10 max-w-2xl font-medium">
            Create a room instantly. Invite friends and watch your favorite
            videos in perfect sync with live chat.
          </p>

          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-4xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center rounded-3xl border border-violet-300/40 bg-white/72 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_35px_rgba(124,58,237,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-black/35 sm:p-3"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session name (e.g. Lofi Cafe)..."
              required
              className="min-h-12 flex-1 border-none bg-transparent px-4 text-base shadow-none focus-visible:ring-0 sm:text-lg"
            />

            <div className="mx-2 hidden h-8 w-px bg-violet-300/35 dark:bg-white/10 sm:block"></div>

            <div className="flex gap-2 w-full sm:w-auto px-2 pb-2 sm:pb-0">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${!isPrivate ? "bg-primary/20 text-primary ring-1 ring-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.22)]" : "text-muted-foreground hover:bg-accent/70 dark:hover:bg-white/5"}`}
              >
                <GlobeIcon className="size-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${isPrivate ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "text-muted-foreground hover:bg-accent/70 dark:hover:bg-white/5"}`}
              >
                <LockIcon className="size-4" /> Private
              </button>
            </div>

            {isPrivate && (
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secret passcode..."
                required={isPrivate}
                className="mb-2 w-full min-h-12 rounded-2xl border-violet-300/35 bg-white/78 text-sm transition-all focus-visible:ring-red-500/50 dark:border-white/10 dark:bg-black/40 sm:mb-0 sm:w-40"
              />
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className={`w-full sm:w-auto min-h-[3.2rem] px-8 rounded-2xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all text-base font-bold ${isPrivate ? "hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] bg-red-600 hover:bg-red-500 text-white" : ""}`}
            >
              {isSubmitting ? "Launching..." : "Launch"}
            </Button>
          </form>
        </section>

        {/* ACTIVE ROOMS GRID */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4 dark:border-white/5">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight">
                Explore Rooms
              </h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Join an active session and watch together.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 text-sm focus-visible:ring-primary/40 dark:border-white/10 dark:bg-black/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoadingRooms ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass-card rounded-3xl border-dashed">
                <SearchIcon className="size-8 mx-auto mb-3 opacity-30 animate-pulse" />
                <p>Loading sessions...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass-card rounded-3xl border-dashed">
                <SearchIcon className="size-8 mx-auto mb-3 opacity-30" />
                <p>No rooms found matching &quot;{searchQuery}&quot;.</p>
              </div>
            ) : null}

            {!isLoadingRooms &&
              filteredRooms.map((room) => (
                <Card
                  key={room.roomId}
                  className={`glass-card border-border/60 hover:border-primary/40 transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col hover:-translate-y-1 rounded-3xl dark:border-white/10`}
                  onClick={() => router.push(`/room/join/${room.roomId}`)}
                >
                  {/* Visual Header */}
                  <div
                    className="h-28 relative border-b border-border/50 bg-cover bg-center dark:border-white/5"
                    style={{
                      backgroundImage: extractYoutubeId(room.videoUrl)
                        ? `url(https://img.youtube.com/vi/${extractYoutubeId(room.videoUrl)}/hqdefault.jpg)`
                        : "none",
                    }}
                  >
                    {/* Backdrop overlay for readability if map has video */}
                    {extractYoutubeId(room.videoUrl) && (
                      <div className="absolute inset-0 bg-slate-950/20 transition-all group-hover:bg-slate-950/10 dark:bg-black/20 dark:group-hover:bg-black/10" />
                    )}

                    {!extractYoutubeId(room.videoUrl) && (
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/30 via-background to-background" />
                    )}

                    <div className="absolute top-4 right-4 z-10">
                      {room.isPrivate ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-red-500/30 bg-red-500/15 text-red-700 shadow-sm backdrop-blur-md dark:bg-red-950/40 dark:text-red-400"
                        >
                          <LockIcon className="size-3" /> Private
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-700 shadow-sm backdrop-blur-md dark:bg-emerald-950/40 dark:text-emerald-400"
                        >
                          <GlobeIcon className="size-3" /> Public
                        </Badge>
                      )}
                    </div>
                    <div className="absolute -bottom-5 left-5 z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-lg text-primary dark:border-white/10">
                      <MonitorPlayIcon className="size-5" />
                    </div>
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col pt-8">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {room.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2 mb-6 font-medium">
                      <UsersRoundIcon className="size-4 opacity-70" />{" "}
                      {room.memberCount} currently watching
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-4 dark:border-white/5">
                      <div className="flex -space-x-2">
                        {/* Decorative avatars */}
                        {[...Array(Math.min(3, room.memberCount))].map(
                          (_, i) => (
                            <div
                              key={i}
                              className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-muted text-[8px] text-muted-foreground shadow-sm dark:border-black dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              👤
                            </div>
                          ),
                        )}
                        {room.memberCount > 3 && (
                          <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-primary/20 text-[9px] font-bold text-primary shadow-sm dark:border-black">
                            +{room.memberCount - 3}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="glass-card bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(232,121,249,0.05)]"
                      >
                        Join Party
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
