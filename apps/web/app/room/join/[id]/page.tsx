"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon, MonitorPlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const isPrivateMock = roomId.includes("private");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);

    try {
      await new Promise(res => setTimeout(res, 800)); // simulate API call
      router.replace(`/room/${roomId}`);
    } catch {
      alert("Failed to join the room (Incorrect password?).");
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.1),transparent_45%)] flex items-center justify-center font-sans text-foreground">
      <div className="glass-card w-full max-w-md p-8 rounded-[2rem] text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 h-32 w-32 rounded-full bg-primary/20 blur-[60px] pointer-events-none" />

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary shadow-[0_0_20px_rgba(232,121,249,0.2)] mb-6">
          <MonitorPlayIcon className="size-10" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Joining Room</h1>
          <p className="text-muted-foreground mt-2 font-medium break-all">ID: {roomId}</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-5 pt-4">
          {isPrivateMock && (
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
                className="bg-black/30 border-white/10 h-12 rounded-xl focus-visible:ring-red-500/50"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isJoining}
            className="w-full h-14 text-base font-bold shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all rounded-xl"
          >
            {isJoining ? "Connecting..." : "Enter Room"}
          </Button>
        </form>

        <Button asChild variant="ghost" className="mt-4 hover:bg-white/10 h-10 w-full rounded-xl">
          <button type="button" onClick={() => router.push("/hub")}>Cancel</button>
        </Button>
      </div>
    </div>
  );
}
