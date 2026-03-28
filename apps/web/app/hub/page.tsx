"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOutIcon,
  LockIcon,
  GlobeIcon,
  UsersRoundIcon,
  VideoIcon,
  SearchIcon,
  MonitorPlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Room {
  roomId: string;
  title: string;
  videoUrl: string | null;
  isPrivate: boolean;
  password?: string | null;
  hostUserId: string;
  memberCount: number;
  status: string;
  createdAt: string;
}

export default function HubPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        } else {
          console.error("Failed to fetch rooms:", res.status);
        }
      } catch (err) {
        console.error("Error fetching rooms:", err);
      } finally {
        setIsLoadingRooms(false);
      }
    }
    fetchRooms();
  }, []);

  // Create Room Form State
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = rooms.filter(room => room.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {
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
      router.push(`/room/${data.roomId}`);
    } catch (error) {
      console.error("Failed to create room", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.1),transparent_45%)] flex flex-col font-sans text-foreground">

      {/* Navbar */}
      <header className="glass-card sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between px-6 sm:px-10 border-x-0 border-t-0 rounded-none border-white/10 bg-card/40 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(232,121,249,0.2)]">
            <VideoIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">WatchParty</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-9 glass-card hover:bg-white/10 gap-2">
            <Link href="/logout">
              <LogOutIcon className="size-4" />
              <span className="hidden sm:inline font-medium">Sign Out</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8 flex flex-col gap-12 mt-4 pb-20">

        {/* HERO CREATE SECTION */}
        <section className="glass-card rounded-[2rem] p-6 sm:p-12 border-white/10 relative overflow-hidden flex flex-col items-center text-center shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />

          <Badge variant="outline" className="glass-card gap-1 py-1 px-3 text-xs font-semibold border-primary/30 text-primary mb-6">
            New Session
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground drop-shadow-md">
            Start a Watch Party
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl mb-10 max-w-2xl font-medium">
            Create a room instantly. Invite friends and watch your favorite videos in perfect sync with live chat.
          </p>

          <form onSubmit={handleCreateRoom} className="w-full max-w-4xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-black/40 p-2 sm:p-3 rounded-3xl border border-white/10 backdrop-blur-md shadow-inner">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session name (e.g. Lofi Cafe)..."
              required
              className="flex-1 min-h-[3rem] bg-transparent border-none shadow-none focus-visible:ring-0 text-base sm:text-lg px-4"
            />

            <div className="h-8 w-px bg-white/10 hidden sm:block mx-2"></div>

            <div className="flex gap-2 w-full sm:w-auto px-2 pb-2 sm:pb-0">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${!isPrivate ? 'bg-primary/20 text-primary ring-1 ring-primary/50 shadow-[0_0_15px_rgba(232,121,249,0.2)]' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <GlobeIcon className="size-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${isPrivate ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-muted-foreground hover:bg-white/5'}`}
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
                className="w-full sm:w-40 min-h-[3rem] bg-black/40 border-white/10 focus-visible:ring-red-500/50 transition-all rounded-2xl text-sm mb-2 sm:mb-0"
              />
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className={`w-full sm:w-auto min-h-[3.2rem] px-8 rounded-2xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all text-base font-bold ${isPrivate ? 'hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] bg-red-600 hover:bg-red-500 text-white' : ''}`}
            >
              {isSubmitting ? "Launching..." : "Launch"}
            </Button>
          </form>
        </section>

        {/* ACTIVE ROOMS GRID */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight">Explore Rooms</h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">Join an active session and watch together.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                className="pl-10 h-11 rounded-xl bg-black/20 border-white/10 focus-visible:ring-primary/40 text-sm"
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

            {!isLoadingRooms && filteredRooms.map((room) => (
              <Card key={room.roomId} className={`glass-card border-white/10 hover:border-primary/40 transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col hover:-translate-y-1 rounded-3xl`} onClick={() => router.push(`/room/join/${room.roomId}`)}>

                {/* Visual Header */}
                <div className="h-28 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-background to-background relative border-b border-white/5">
                  <div className="absolute top-4 right-4">
                    {room.isPrivate ? (
                      <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-950/40 backdrop-blur-md gap-1">
                        <LockIcon className="size-3"/> Private
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/40 backdrop-blur-md gap-1">
                        <GlobeIcon className="size-3"/> Public
                      </Badge>
                    )}
                  </div>
                  <div className="absolute -bottom-5 left-5 w-12 h-12 rounded-2xl bg-card border border-white/10 shadow-lg flex items-center justify-center text-primary">
                    <MonitorPlayIcon className="size-5" />
                  </div>
                </div>

                <CardContent className="p-5 flex-1 flex flex-col pt-8">
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">{room.title}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2 mb-6 font-medium">
                    <UsersRoundIcon className="size-4 opacity-70"/> {room.memberCount} currently watching
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                    <div className="flex -space-x-2">
                       {/* Decorative avatars */}
                       {[...Array(Math.min(3, room.memberCount))].map((_, i) => (
                          <div key={i} className="w-7 h-7 rounded-full border border-black bg-zinc-800 flex justify-center items-center text-[8px] text-zinc-400 shadow-sm z-10">👤</div>
                       ))}
                       {room.memberCount > 3 && (
                          <div className="w-7 h-7 rounded-full border border-black bg-primary/20 flex justify-center items-center text-[9px] text-primary font-bold shadow-sm z-10">+{room.memberCount - 3}</div>
                       )}
                    </div>
                    <Button size="sm" variant="secondary" className="glass-card bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(232,121,249,0.05)]">
                      Join Party
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
