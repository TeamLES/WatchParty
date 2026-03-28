"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  CopyIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  PlayIcon,
  SendIcon,
  SettingsIcon,
  Share2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Server Room Detail Type
interface RoomDetail {
  id: string;
  title: string;
  url: string;
  membersCount: number;
  hostId: string;
  isHost?: boolean;
}

// YouTube ID Extractor
const extractYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Hardcoded mock messages
const INITAL_MESSAGES = [
  { id: 1, user: "You", text: "Hey, is everyone here?", time: "20:41", isMe: true },
  { id: 2, user: "Alex", text: "Yeah, ready to start", time: "20:42", isMe: false },
  { id: 3, user: "Nina", text: "Waiting, play it 🍿", time: "20:42", isMe: false },
];

const generateReactionContext = () => ({
  id: Date.now() + Math.random(),
  left: 10 + Math.random() * 80,
  rotation: Math.floor(Math.random() * 60) - 30,
});

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [messages, setMessages] = useState(INITAL_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [flyingEmojis, setFlyingEmojis] = useState<{ id: number; emoji: string; left: number; rotation: number }[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch actual room data
  useEffect(() => {
    async function fetchRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch room");
        }
        const data = await res.json();

        console.log("Room INFO (vrátené z API):", data);
        console.log("Video URL tejto roomky:", data.videoUrl);

        setRoom({
          id: data.roomId,
          title: data.title,
          url: data.videoUrl || "",
          membersCount: data.memberCount,
          hostId: data.hostUserId,
          isHost: typeof data.isHost === "boolean" ? data.isHost : undefined,
        });

        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setActiveVideoId(extractYoutubeId(data.videoUrl));
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoom();
  }, [roomId]);

  const handlePlay = () => {
    const canControlVideo = room
      ? (typeof room.isHost === "boolean" ? room.isHost : true)
      : false;

    if (!canControlVideo) {
      alert("Only the host can change the video!");
      return;
    }

    const id = extractYoutubeId(videoUrl);
    if (id) {
      setActiveVideoId(id);
    } else {
      alert("Please enter a valid YouTube URL.");
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        user: "You",
        text: newMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      }
    ]);
    setNewMessage("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopyInvite = async () => {
    const joinUrl = `${window.location.origin}/room/join/${roomId}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = joinUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      alert("Invite link copied!");
    } catch {
      alert(`Copy failed. Use this link manually: ${joinUrl}`);
    }
  };

  const handleReaction = (emoji: string) => {
    const { id, left, rotation } = generateReactionContext();
    setFlyingEmojis((prev) => [...prev, { id, emoji, left, rotation }]);

    setTimeout(() => {
      setFlyingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="animate-pulse">Loading room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p>Room not found.</p>
        <Button asChild><Link href="/hub">Back to Hub</Link></Button>
      </div>
    );
  }

  // If API does not send isHost yet, keep controls available instead of hiding the input.
  const canControlVideo = typeof room.isHost === "boolean" ? room.isHost : true;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.16),transparent_40%),radial-gradient(circle_at_50%_95%,rgba(147,51,234,0.15),transparent_50%)] flex flex-col font-sans text-foreground">

      {/* Room Header */}
      <header className="glass-card sticky top-16 z-40 flex h-16 shrink-0 items-center justify-between px-6 border-x-0 border-t-0 rounded-none border-white/10 bg-card/40 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <Link href="/hub" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
            <MonitorPlayIcon className="size-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
              {room.title}
              {room.isHost && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">HOST</span>}
            </h1>
            <p className="text-xs text-muted-foreground">{room.membersCount} connected</p>
            {!canControlVideo ? (
              <p className="text-[11px] text-muted-foreground/90">View-only mode: only host can control playback.</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="glass-card border-primary/30 text-primary hover:bg-primary/20 gap-2 h-9"
            onClick={handleCopyInvite}
          >
            <Share2Icon className="size-4" />
            <span className="hidden sm:inline">Copy Invite</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full glass-card hover:bg-white/10">
            <SettingsIcon className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 overflow-hidden max-h-[calc(100vh-4rem)]">

        {/* Video Column */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Video Control Panel */}
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center shrink-0">
            <div className="flex-1 w-full relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <CopyIcon className="size-4" />
              </div>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube link here..."
                className="pl-10 h-12 bg-black/20 border-white/10 focus-visible:ring-primary/50 text-base"
                onKeyDown={(e) => e.key === "Enter" && handlePlay()}
                disabled={!canControlVideo}
              />
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 px-8 rounded-xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all gap-2"
              onClick={handlePlay}
              disabled={!canControlVideo}
            >
              <PlayIcon className="size-5 fill-current" />
              <span className="font-semibold">Play for Everyone</span>
            </Button>
          </div>

          {/* Video Player */}
          <div className="glass-card rounded-3xl flex-1 relative overflow-hidden bg-black/60 shadow-2xl min-h-[300px]">
            {/* Flying Emojis */}
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              {flyingEmojis.map(({ id, emoji, left, rotation }) => (
                <div
                  key={id}
                  className="absolute bottom-0 text-5xl animate-[flyUp_2.5s_ease-out_forwards]"
                  style={{
                    left: `${left}%`,
                    transform: `rotate(${rotation}deg)`
                  }}
                >
                  <div style={{ transform: `rotate(${rotation}deg)` }}>
                    {emoji}
                  </div>
                </div>
              ))}
            </div>

            {activeVideoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title="WatchParty Video Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <MonitorPlayIcon className="size-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Nothing playing right now</p>
                <p className="text-sm">Host will start a video soon.</p>
              </div>
            )}
          </div>
        </section>

        {/* Live Chat Column */}
        <aside className="w-full lg:w-96 xl:w-[400px] flex flex-col shrink-0 gap-4 h-[500px] lg:h-auto">
          <div className="glass-card rounded-3xl flex flex-col h-full overflow-hidden border-white/10">

            {/* Chat Header */}
            <div className="p-4 border-b border-white/10 bg-black/10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareTextIcon className="size-5 text-primary" />
                <h2 className="font-semibold text-lg">Room Chat</h2>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{msg.user}</span>
                    <span className="text-[10px] text-muted-foreground/60">{msg.time}</span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white/10 text-foreground rounded-bl-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Reactions Center */}
            <div className="px-4 py-2 shrink-0 bg-black/10 border-t border-white/5 flex items-center justify-center gap-4 overflow-x-auto">
              {['😀', '😢', '😡', '❤️'].map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReaction(emoji)}
                  className="h-10 w-10 p-0 rounded-full hover:bg-white/10 text-xl transition-transform hover:scale-110"
                >
                  {emoji}
                </Button>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 pt-2 shrink-0 bg-black/10">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="pr-12 h-12 rounded-xl bg-black/20 border-white/10 focus-visible:ring-primary/50 text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 h-10 w-10 rounded-lg text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                  disabled={!newMessage.trim()}
                >
                  <SendIcon className="size-4" />
                </Button>
              </form>
            </div>

          </div>
        </aside>

      </main>
    </div>
  );
}
