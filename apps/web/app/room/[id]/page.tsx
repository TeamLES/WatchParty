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
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

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
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handlePlay = async () => {
    if (!room?.isHost) {
      alert("Only the host can change the video!");
      return;
    }

    const id = extractYoutubeId(videoUrl);
    if (!id) {
      alert("Please enter a valid YouTube URL.");
      return;
    }

    setIsUpdatingVideo(true);

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });

      if (!res.ok) {
        throw new Error("Nepodarilo sa updatnúť videoUrl");
      }

      // Aktulizacia prebehla uspesne
      setActiveVideoId(id);
    } catch (err) {
      console.error(err);
      alert("Chyba pri zmene videa. Skontroluj konzolu.");
    } finally {
      setIsUpdatingVideo(false);
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
    setInviteUrl(joinUrl);

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

      setShowInviteModal(true);
    } catch {
      alert(`Copy failed. Use this link manually: ${joinUrl}`);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room?.isHost) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Nepodarilo sa zmazať roomku.");
      }

      router.push("/hub");
    } catch (err) {
      console.error(err);
      alert("Chyba pri mazaní miestnosti.");
      setIsDeleting(false);
      setShowDeleteModal(false);
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
    <div className="relative min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.16),transparent_40%),radial-gradient(circle_at_50%_95%,rgba(147,51,234,0.15),transparent_50%)] flex flex-col font-sans text-foreground pt-4">

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 pb-6 overflow-hidden max-h-[calc(100vh-4rem-1rem)]">

        {/* Video Column (Main Content) */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Integrated Room Info Bar */}
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-4 shrink-0 shadow-sm border border-white/10 bg-black/20">
            {/* Top row: Title and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/hub" className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-transform hover:scale-105 shadow-inner">
                  <MonitorPlayIcon className="size-6" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold leading-tight flex items-center gap-2 tracking-tight">
                    {room.title}
                    {room.isHost && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {room.membersCount} watching now
                    </p>
                    {!canControlVideo && (
                      <span className="text-[11px] text-muted-foreground/80 bg-white/5 px-1.5 rounded">View-only mode</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold gap-2 border border-primary/20 transition-all rounded-xl h-10"
                  onClick={handleCopyInvite}
                >
                  <Share2Icon className="size-4" />
                  <span className="hidden lg:inline">Invite Friends</span>
                </Button>

                {room.isHost && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white gap-2 transition-all rounded-xl h-10"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting}
                  >
                    <TrashIcon className="size-4" />
                    <span className="hidden lg:inline">{isDeleting ? "Deleting..." : "Delete Room"}</span>
                  </Button>
                )}

                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                  <SettingsIcon className="size-5" />
                </Button>
              </div>
            </div>

            {/* Bottom row: Video Control Panel */}
            {canControlVideo && (
              <div className="flex flex-col sm:flex-row gap-3 items-center w-full pt-4 border-t border-white/5">
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <CopyIcon className="size-4" />
                  </div>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube link here..."
                    className="pl-10 h-11 bg-black/20 border-white/10 focus-visible:ring-primary/50 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && !isUpdatingVideo && handlePlay()}
                    disabled={isUpdatingVideo}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full sm:w-auto h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all gap-2"
                  onClick={handlePlay}
                  disabled={isUpdatingVideo || !videoUrl}
                >
                  <PlayIcon className="size-4 fill-current" />
                  <span className="font-semibold">{isUpdatingVideo ? "Mení sa..." : "Play for Everyone"}</span>
                </Button>
              </div>
            )}
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
        <aside className="w-full lg:w-96 xl:w-[400px] flex flex-col shrink-0 gap-4 h-[500px] lg:h-auto pb-2">
          <div className="glass-card rounded-3xl flex flex-col h-full overflow-hidden border-white/10 shadow-lg">

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

      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Link Copied!">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(232,121,249,0.3)]">
            <Share2Icon className="size-8" />
          </div>
          <p className="text-muted-foreground text-sm">
            Send this link to your friends so they can join you! The link is already copied to your clipboard.
          </p>
          <div className="w-full bg-black/30 border border-white/10 p-3 rounded-xl overflow-hidden mt-2">
            <p className="text-xs font-mono text-primary truncate select-all">{inviteUrl}</p>
          </div>
          <Button onClick={() => setShowInviteModal(false)} className="w-full mt-2 rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.2)]">
            Got it
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => !isDeleting && setShowDeleteModal(false)} title="Delete this room?">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <TrashIcon className="size-8" />
          </div>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to end this WatchParty? This action will permanently delete the room history and remove all current viewers.
          </p>
          <div className="flex w-full gap-3 mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="flex-1 rounded-xl hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRoom}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              {isDeleting ? "Deleting..." : "Yes, delete it"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
