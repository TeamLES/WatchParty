"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon, MonitorPlayIcon } from "lucide-react";
import type { GetRoomResponse } from "@watchparty/shared-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  const router = useRouter();

  const [room, setRoom] = useState<GetRoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    async function fetchRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) {
          throw new Error("Pravdepodobne neexistuje");
        }
        const data = await res.json();

        // Only bypass join page if the user is already a room member.
        if (data.isMember) {
          router.replace(`/room/${roomId}`);
          return;
        }

        setRoom(data as GetRoomResponse);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoom();
  }, [roomId, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require password for private rooms
    if (room?.isPrivate && !password?.trim()) {
      alert("Heslo je vyžadované pre private roomu");
      return;
    }

    setIsJoining(true);

    try {
      const payload: Record<string, string> = {};
      if (room?.isPrivate && password) {
        payload.password = password;
      }

      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Join fallback response", res.status, errText);
        throw new Error(`Nepodarilo sa pripojiť: ${res.status}`);
      }

      if (room?.isPrivate) {
        sessionStorage.setItem(`unlocked_room_${roomId}`, "true");
      }

      router.replace(`/room/${roomId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`Chyba pri pripájaní: ${message}`);
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="page-surface flex min-h-screen items-center justify-center text-foreground">
        <p className="animate-pulse">Checking access...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page-surface flex min-h-screen flex-col items-center justify-center gap-4 text-foreground">
        <p>Room not found.</p>
        <Button asChild>
          <button type="button" onClick={() => router.push("/hub")}>
            Back to Hub
          </button>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-surface flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.14),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(192,132,252,0.12),transparent_45%)] font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.16),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(192,132,252,0.14),transparent_48%)]">
      <div className="glass-card w-full max-w-md p-8 rounded-[2rem] text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 h-32 w-32 rounded-full bg-primary/20 blur-[60px] pointer-events-none" />

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary shadow-[0_0_20px_rgba(232,121,249,0.2)] mb-6">
          <MonitorPlayIcon className="size-10" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Joining Room
          </h1>
          <p className="text-muted-foreground mt-2 font-medium break-all">
            ID: {roomId}
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-5 pt-4">
          {room.isPrivate && (
            <div className="space-y-2 text-left">
              <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <LockIcon className="size-4 text-red-500" /> Room is private
              </label>
              <Input
                type="password"
                placeholder="Enter password to join..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-border/70 bg-background/72 focus-visible:ring-red-500/50 dark:border-white/10 dark:bg-black/30"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isJoining || (room?.isPrivate && !password?.trim())}
            className="w-full h-14 text-base font-bold shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all rounded-xl"
          >
            {isJoining ? "Connecting..." : "Enter Room"}
          </Button>
        </form>

        <Button
          asChild
          variant="ghost"
          className="mt-4 h-10 w-full rounded-xl hover:bg-accent dark:hover:bg-white/10"
        >
          <button type="button" onClick={() => router.push("/hub")}>
            Cancel
          </button>
        </Button>
      </div>
    </div>
  );
}
