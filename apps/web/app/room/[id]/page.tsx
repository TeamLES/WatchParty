"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookmarkPlusIcon,
  CopyIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  PlayIcon,
  SendIcon,
  SettingsIcon,
  Share2Icon,
  TrashIcon,
  PanelRightCloseIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  AuthMeResponse,
  CreateHighlightRequest,
  CreateHighlightResponse,
  GetHighlightsResponse,
  GetRoomResponse,
  HighlightResponse,
  RoomMemberResponse,
  ChatMessageEvent,
  ReactionEvent,
} from "@watchparty/shared-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  SyncedYouTubePlayer,
  type SyncedYouTubePlayerRef,
} from "@/components/app/synced-youtube-player";
import { extractYoutubeId } from "@/lib/youtube";

// Hardcoded mock messages
const INITAL_MESSAGES = [
  {
    id: 1,
    user: "You",
    text: "Hey, is everyone here?",
    time: "20:41",
    isMe: true,
  },
  {
    id: 2,
    user: "Alex",
    text: "Yeah, ready to start",
    time: "20:42",
    isMe: false,
  },
  {
    id: 3,
    user: "Nina",
    text: "Waiting, play it 🍿",
    time: "20:42",
    isMe: false,
  },
];

const EMOJI_LIST = ["😂", "❤️", "🔥", "👀"];

function formatDurationMs(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;

  const [room, setRoom] = useState<GetRoomResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  );
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [messages, setMessages] = useState(INITAL_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [flyingEmojis, setFlyingEmojis] = useState<
    { id: number; emoji: string; left: number; rotation: number }[]
  >([]);
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [liveOnlineCount, setLiveOnlineCount] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenChatOpen, setIsFullscreenChatOpen] = useState(true);
  const [highlights, setHighlights] = useState<HighlightResponse[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(
    null,
  );
  const [lastKnownPositionMs, setLastKnownPositionMs] = useState(0);

  const socketPlayerRef = useRef<SyncedYouTubePlayerRef>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasLeftRoomRef = useRef(false);
  const localReplayTimerRef = useRef<number | null>(null);
  const localReplayRestoreTimerRef = useRef<number | null>(null);
  const router = useRouter();

  const fetchRoomSnapshot = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Failed to fetch room");
    }

    return (await res.json()) as GetRoomResponse;
  }, [roomId]);

  const fetchHighlights = useCallback(async () => {
    setIsLoadingHighlights(true);

    try {
      const res = await fetch(`/api/rooms/${roomId}/highlights`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch highlights");
      }

      const data = (await res.json()) as GetHighlightsResponse;
      setHighlights(data.highlights);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingHighlights(false);
    }
  }, [roomId]);

  const formatMemberDisplayName = useCallback((member: RoomMemberResponse) => {
    const nickname = member.nickname?.trim();

    if (nickname) {
      return nickname;
    }

    if (member.userId.startsWith("guest-")) {
      return `Guest ${member.userId.slice(-4)}`;
    }

    return `User ${member.userId.slice(0, 8)}`;
  }, []);

  // Fetch initial room data and current user.
  useEffect(() => {
    async function fetchRoom() {
      try {
        const [roomData, meResponse] = await Promise.all([
          fetchRoomSnapshot(),
          fetch("/api/me", { cache: "no-store" }),
        ]);

        if (meResponse.ok) {
          const me = (await meResponse.json()) as AuthMeResponse;
          setCurrentUserId(me.sub);
        }

        console.log("Room INFO (vrátené z API):", roomData);
        console.log("Video URL tejto roomky:", roomData.videoUrl);

        if (!roomData.isMember) {
          router.replace(`/room/join/${roomId}`);
          return;
        }

        setRoom(roomData);

        setEditTitle(roomData.title);

        if (roomData.videoUrl) {
          setVideoUrl(roomData.videoUrl);
          setActiveVideoId(extractYoutubeId(roomData.videoUrl));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoom();
  }, [fetchRoomSnapshot, roomId, router]);

  const hasRoomLoaded = room !== null;

  useEffect(() => {
    if (!hasRoomLoaded) {
      return;
    }

    void fetchHighlights();
  }, [fetchHighlights, hasRoomLoaded]);

  useEffect(() => {
    if (!activeVideoId) {
      setLastKnownPositionMs(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLastKnownPositionMs(
        socketPlayerRef.current?.getCurrentPositionMs() ?? 0,
      );
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeVideoId]);

  // Refresh room members and count periodically while the page is open.
  useEffect(() => {
    if (!hasRoomLoaded) {
      return;
    }

    const refreshRoom = async () => {
      try {
        const latestRoom = await fetchRoomSnapshot();

        if (!latestRoom.isMember) {
          router.replace(`/room/join/${roomId}`);
          return;
        }

        setRoom(latestRoom);

        if (latestRoom.videoUrl) {
          setVideoUrl(latestRoom.videoUrl);
          setActiveVideoId(extractYoutubeId(latestRoom.videoUrl));
        }
      } catch (error) {
        console.error("Failed to refresh room", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshRoom();
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchRoomSnapshot, hasRoomLoaded, roomId, router]);

  const shouldTrackLeave = room?.isHost === false;

  // Best-effort leave on tab close/navigation for non-host members.
  useEffect(() => {
    if (!shouldTrackLeave) {
      return;
    }

    hasLeftRoomRef.current = false;

    const leaveRoom = () => {
      if (hasLeftRoomRef.current) {
        return;
      }

      hasLeftRoomRef.current = true;
      const leaveUrl = `/api/rooms/${roomId}/leave`;

      if (navigator.sendBeacon) {
        navigator.sendBeacon(leaveUrl, new Blob());
        return;
      }

      void fetch(leaveUrl, {
        method: "POST",
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", leaveRoom);

    return () => {
      window.removeEventListener("beforeunload", leaveRoom);
      leaveRoom();
    };
  }, [roomId, shouldTrackLeave]);

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

    socketPlayerRef.current?.sendChatMessage(newMessage);
    setNewMessage("");
  };

  const handleChatEvent = useCallback(
    (event: ChatMessageEvent | ReactionEvent) => {
      const existingMember = room?.members.find(
        (m) => m.userId === event.userId,
      );
      let displayName = "Anon";
      if (existingMember) {
        displayName = formatMemberDisplayName(existingMember);
      } else if (event.userId.startsWith("guest-")) {
        displayName = `Guest ${event.userId.slice(-4)}`;
      } else {
        displayName = `User ${event.userId.slice(0, 8)}`;
      }

      if (event.type === "chat.message") {
        setMessages((prev) => [
          ...prev,
          {
            id: Number(
              event.messageId.replace(/\D/g, "").slice(0, 10) || Date.now(),
            ),
            user: displayName,
            text: event.text,
            time: new Date(event.sentAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isMe: existingMember
              ? existingMember.userId === currentUserId
              : false,
          },
        ]);
      } else if (event.type === "chat.reaction") {
        const id = Date.now();
        // distribute them randomly across mostly full screen width
        // but if the chat is open, maybe they shouldn't go entirely under it
        const maxRight = isFullscreen && isFullscreenChatOpen ? 70 : 95;
        const left = 5 + Math.random() * maxRight;
        const rotation = -20 + Math.random() * 40; // -20deg to +20deg
        setFlyingEmojis((prev) => [
          ...prev,
          { id, emoji: event.emoji, left, rotation },
        ]);

        setTimeout(() => {
          setFlyingEmojis((prev) => prev.filter((e) => e.id !== id));
        }, 2500);
      }
    },
    [
      currentUserId,
      formatMemberDisplayName,
      room?.members,
      isFullscreen,
      isFullscreenChatOpen,
    ],
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isFullscreen]);

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
    socketPlayerRef.current?.sendReaction(emoji);
  };

  const handleCreateHighlight = async () => {
    const currentPositionMs =
      socketPlayerRef.current?.getCurrentPositionMs() ?? lastKnownPositionMs;

    if (!activeVideoId || currentPositionMs <= 0) {
      return;
    }

    setIsCreatingHighlight(true);

    try {
      const payload: CreateHighlightRequest = {
        startMs: Math.max(0, currentPositionMs - 30000),
        endMs: currentPositionMs,
        title: `Highlight at ${formatDurationMs(currentPositionMs)}`,
      };
      const res = await fetch(`/api/rooms/${roomId}/highlights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create highlight");
      }

      const created = (await res.json()) as CreateHighlightResponse;
      setHighlights((prev) => [created.highlight, ...prev]);
      void fetchHighlights();
    } catch (error) {
      console.error(error);
      alert("Unable to save a highlight right now.");
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const handlePlayHighlight = (highlight: HighlightResponse) => {
    if (localReplayTimerRef.current !== null) {
      window.clearTimeout(localReplayTimerRef.current);
      localReplayTimerRef.current = null;
    }

    if (localReplayRestoreTimerRef.current !== null) {
      window.clearTimeout(localReplayRestoreTimerRef.current);
      localReplayRestoreTimerRef.current = null;
    }

    const roomVideoId = extractYoutubeId(room?.videoUrl);
    const playSegment = () => {
      socketPlayerRef.current?.playLocalSegment(
        highlight.startMs,
        highlight.endMs,
      );
    };

    if (highlight.videoId === activeVideoId) {
      playSegment();
      return;
    }

    setActiveVideoId(highlight.videoId);
    localReplayTimerRef.current = window.setTimeout(playSegment, 900);

    if (roomVideoId) {
      const segmentLengthMs = Math.max(0, highlight.endMs - highlight.startMs);
      localReplayRestoreTimerRef.current = window.setTimeout(() => {
        setActiveVideoId(roomVideoId);
      }, segmentLengthMs + 1600);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    setDeletingHighlightId(highlightId);

    try {
      const res = await fetch(`/api/rooms/${roomId}/highlights/${highlightId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete highlight");
      }

      setHighlights((prev) =>
        prev.filter((highlight) => highlight.highlightId !== highlightId),
      );
      void fetchHighlights();
    } catch (error) {
      console.error(error);
      alert("Unable to delete this highlight right now.");
    } finally {
      setDeletingHighlightId(null);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room?.isHost || !editTitle.trim() || editTitle === room.title) {
      setShowSettingsModal(false);
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update room title");

      const updatedRoom = (await res.json()) as GetRoomResponse;
      setRoom(updatedRoom);
      setEditTitle(updatedRoom.title);
      setShowSettingsModal(false);
    } catch (err) {
      console.error(err);
      alert("Error updating room settings.");
    }
  };

  useEffect(() => {
    return () => {
      if (localReplayTimerRef.current !== null) {
        window.clearTimeout(localReplayTimerRef.current);
      }

      if (localReplayRestoreTimerRef.current !== null) {
        window.clearTimeout(localReplayRestoreTimerRef.current);
      }
    };
  }, []);

  const handleKickMember = async (memberUserId: string) => {
    if (!room?.isHost) {
      return;
    }

    setKickingMemberId(memberUserId);

    try {
      const res = await fetch(`/api/rooms/${roomId}/kick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: memberUserId }),
      });

      if (!res.ok) {
        throw new Error("Failed to kick member");
      }

      const latestRoom = await fetchRoomSnapshot();
      setRoom(latestRoom);
    } catch (error) {
      console.error(error);
      alert("Unable to kick this member right now.");
    } finally {
      setKickingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-surface flex min-h-screen items-center justify-center text-foreground">
        <p className="animate-pulse">Loading room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page-surface flex min-h-screen flex-col items-center justify-center gap-4 text-foreground">
        <p>Room not found.</p>
        <Button asChild>
          <Link href="/hub">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  // If API does not send isHost yet, keep controls available instead of hiding the input.
  const canControlVideo = typeof room.isHost === "boolean" ? room.isHost : true;
  const watchingCount = liveOnlineCount ?? room.onlineCount ?? 0;

  return (
    <div className="page-surface relative min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_95%,rgba(192,132,252,0.12),transparent_50%)] pt-4 font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.16),transparent_42%),radial-gradient(circle_at_50%_95%,rgba(192,132,252,0.14),transparent_52%)]">
      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 pb-6 lg:overflow-hidden lg:max-h-[calc(100vh-4rem-1rem)]">
        {/* Video Column (Main Content) */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Integrated Room Info Bar */}
          <div className="glass-card panel-surface flex shrink-0 flex-col gap-4 rounded-2xl p-4 shadow-sm">
            {/* Top row: Title and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/hub"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-transform hover:scale-105 shadow-inner"
                >
                  <MonitorPlayIcon className="size-6" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold leading-tight flex items-center gap-2 tracking-tight">
                    {room.title}
                    {room.isHost && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Host
                      </span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {watchingCount} watching now
                    </p>
                    {!canControlVideo && (
                      <span className="rounded bg-accent/55 px-1.5 text-[11px] text-muted-foreground/90 dark:bg-white/5 dark:text-muted-foreground/80">
                        View-only mode
                      </span>
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
                    <span className="hidden lg:inline">
                      {isDeleting ? "Deleting..." : "Delete Room"}
                    </span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:hover:bg-white/10"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <SettingsIcon className="size-5" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end border-t border-border/50 pt-4 dark:border-white/5">
              <Button
                variant="secondary"
                size="sm"
                className="h-10 rounded-xl border border-primary/20 bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                onClick={() => void handleCreateHighlight()}
                disabled={
                  !activeVideoId ||
                  lastKnownPositionMs <= 0 ||
                  isCreatingHighlight
                }
              >
                <BookmarkPlusIcon className="size-4" />
                <span>
                  {isCreatingHighlight ? "Saving..." : "Save highlight"}
                </span>
              </Button>
            </div>

            {/* Bottom row: Video Control Panel */}
            {canControlVideo && (
              <div className="flex w-full flex-col items-center gap-3 border-t border-border/50 pt-4 dark:border-white/5 sm:flex-row">
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <CopyIcon className="size-4" />
                  </div>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube link here..."
                    className="h-11 border-border/70 bg-background/75 pl-10 text-sm focus-visible:ring-primary/50 dark:border-white/10 dark:bg-black/20"
                    onKeyDown={(e) =>
                      e.key === "Enter" && !isUpdatingVideo && handlePlay()
                    }
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
                  <span className="font-semibold">
                    {isUpdatingVideo ? "Mení sa..." : "Play for Everyone"}
                  </span>
                </Button>
              </div>
            )}
          </div>

          {/* Video Player */}
          <div className="glass-card panel-surface relative min-h-[50vh] flex-1 overflow-hidden rounded-3xl shadow-2xl lg:min-h-0 xl:min-h-168">
            <SyncedYouTubePlayer
              ref={socketPlayerRef}
              roomId={roomId}
              videoId={activeVideoId}
              isHost={canControlVideo}
              onOnlineCountChange={setLiveOnlineCount}
              onChatEvent={handleChatEvent}
              onFullscreenChange={setIsFullscreen}
            >
              {/* Flying Emojis */}
              <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                {flyingEmojis.map(({ id, emoji, left, rotation }) => (
                  <div
                    key={id}
                    className="absolute bottom-0 text-5xl animate-[flyUp_2.5s_ease-out_forwards]"
                    style={{
                      left: `${left}%`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    <div style={{ transform: `rotate(${rotation}deg)` }}>
                      {emoji}
                    </div>
                  </div>
                ))}
              </div>

              {isFullscreen && !isFullscreenChatOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto absolute right-4 top-4 z-50 h-10 w-10 rounded-xl bg-black/60 text-white hover:bg-black/80 hover:text-fuchsia-400 backdrop-blur-md transition-all shadow-lg"
                  onClick={() => setIsFullscreenChatOpen(true)}
                  title="Open Chat"
                >
                  <MessageSquareTextIcon className="size-5" />
                </Button>
              )}

              {isFullscreen && isFullscreenChatOpen && (
                <div className="pointer-events-auto absolute right-0 top-0 bottom-0 w-80 z-50 flex flex-col border-l border-white/10 bg-black/80 backdrop-blur-md shadow-2xl transition-transform duration-300">
                  {/* Chat Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/5 p-4 text-white">
                    <div className="flex items-center gap-2">
                      <MessageSquareTextIcon className="size-5 text-fuchsia-400" />
                      <h2 className="font-semibold text-lg">Room Chat</h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                      onClick={() => setIsFullscreenChatOpen(false)}
                      title="Collapse Chat"
                    >
                      <PanelRightCloseIcon className="size-4" />
                    </Button>
                  </div>

                  {/* Messages Scroll Area */}
                  <div
                    ref={chatContainerRef}
                    className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20"
                  >
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-medium text-white/70">
                            {msg.user}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {msg.time}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.isMe ? "rounded-br-sm bg-fuchsia-500 text-white" : "rounded-bl-sm border border-white/10 bg-white/10 text-white"}`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Reactions Center */}
                  <div className="flex shrink-0 items-center justify-center gap-4 overflow-x-auto border-t border-white/10 bg-white/5 px-4 py-2">
                    {EMOJI_LIST.map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(emoji)}
                        className="h-10 w-10 text-white hover:bg-white/10 rounded-full p-0 text-xl transition-transform hover:scale-110"
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="shrink-0 bg-transparent p-4 pt-2">
                    <form
                      onSubmit={handleSendMessage}
                      className="relative flex items-center"
                    >
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="h-12 rounded-xl border border-white/20 bg-black/40 pr-12 text-sm text-white focus-visible:ring-fuchsia-500/50"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 h-10 w-10 rounded-lg text-fuchsia-400 hover:bg-white/10 hover:text-fuchsia-300 transition-colors"
                        disabled={!newMessage.trim()}
                      >
                        <SendIcon className="size-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </SyncedYouTubePlayer>
          </div>
        </section>

        {/* Live Chat Column */}
        <aside className="w-full lg:w-96 xl:w-100 flex flex-col shrink-0 gap-4 h-125 lg:h-auto pb-2">
          {!isFullscreen && (
            <>
              <div className="glass-card panel-surface flex max-h-72 shrink-0 flex-col overflow-hidden rounded-3xl shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-accent/40 p-4 dark:border-white/10 dark:bg-black/10">
                  <div className="flex items-center gap-2">
                    <BookmarkPlusIcon className="size-5 text-primary" />
                    <h2 className="text-lg font-semibold">Highlights</h2>
                  </div>
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {highlights.length}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border dark:scrollbar-thumb-white/10">
                  {isLoadingHighlights ? (
                    <p className="text-sm text-muted-foreground">
                      Loading highlights...
                    </p>
                  ) : highlights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No highlights saved yet.
                    </p>
                  ) : (
                    highlights.map((highlight) => {
                      const creator = room.members.find(
                        (member) => member.userId === highlight.createdByUserId,
                      );
                      const creatorLabel = creator
                        ? formatMemberDisplayName(creator)
                        : `User ${highlight.createdByUserId.slice(0, 8)}`;
                      const canDeleteHighlight =
                        currentUserId === highlight.createdByUserId ||
                        room.isHost;

                      return (
                        <div
                          key={highlight.highlightId}
                          className="rounded-2xl border border-border/60 bg-card/80 p-3 dark:border-white/10 dark:bg-white/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {highlight.title ?? "Untitled highlight"}
                              </p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">
                                {formatDurationMs(highlight.startMs)} -{" "}
                                {formatDurationMs(highlight.endMs)}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                by {creatorLabel}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"
                                onClick={() => handlePlayHighlight(highlight)}
                                title="Play highlight"
                              >
                                <PlayIcon className="size-4 fill-current" />
                              </Button>
                              {canDeleteHighlight && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500"
                                  onClick={() =>
                                    void handleDeleteHighlight(
                                      highlight.highlightId,
                                    )
                                  }
                                  disabled={
                                    deletingHighlightId ===
                                    highlight.highlightId
                                  }
                                  title="Delete highlight"
                                >
                                  <TrashIcon className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="glass-card panel-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl shadow-lg">
              {/* Chat Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-accent/40 p-4 dark:border-white/10 dark:bg-black/10">
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
              <div
                ref={chatContainerRef}
                className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border dark:scrollbar-thumb-white/10"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {msg.user}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {msg.time}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.isMe ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border/60 bg-card/80 text-foreground dark:border-white/10 dark:bg-white/10"}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Reactions Center */}
              <div className="flex shrink-0 items-center justify-center gap-4 overflow-x-auto border-t border-border/50 bg-accent/30 px-4 py-2 dark:border-white/5 dark:bg-black/10">
                {EMOJI_LIST.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(emoji)}
                    className="h-10 w-10 rounded-full p-0 text-xl transition-transform hover:scale-110 hover:bg-accent dark:hover:bg-white/10"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="shrink-0 bg-accent/30 p-4 pt-2 dark:bg-black/10">
                <form
                  onSubmit={handleSendMessage}
                  className="relative flex items-center"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="h-12 rounded-xl border-border/70 bg-background/75 pr-12 text-sm focus-visible:ring-primary/50 dark:border-white/10 dark:bg-black/20"
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
            </>
          )}
        </aside>
      </main>

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Link Copied!"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(232,121,249,0.3)]">
            <Share2Icon className="size-8" />
          </div>
          <p className="text-muted-foreground text-sm">
            Send this link to your friends so they can join you! The link is
            already copied to your clipboard.
          </p>
          <div className="mt-2 w-full overflow-hidden rounded-xl border border-border/60 bg-card/85 p-3 dark:border-white/10 dark:bg-black/30">
            <p className="text-xs font-mono text-primary truncate select-all">
              {inviteUrl}
            </p>
          </div>
          <Button
            onClick={() => setShowInviteModal(false)}
            className="w-full mt-2 rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.2)]"
          >
            Got it
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="Delete this room?"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <TrashIcon className="size-8" />
          </div>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to end this WatchParty? This action will
            permanently delete the room history and remove all current viewers.
          </p>
          <div className="flex w-full gap-3 mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
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

      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Room Settings"
      >
        <form onSubmit={handleUpdateSettings} className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              Room Title
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={!room?.isHost}
              className="h-12 rounded-xl border-border/70 bg-background/75 text-base focus-visible:ring-primary/50 dark:border-white/10 dark:bg-black/30"
              placeholder="Enter room title..."
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-muted-foreground">
              Current Members ({room?.memberCount})
            </label>
            <div className="flex flex-col gap-2 max-h-50 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {(room?.members ?? []).map((member) => {
                const isCurrentUser = currentUserId === member.userId;
                const displayName = formatMemberDisplayName(member);
                const avatarLabel = displayName.charAt(0).toUpperCase() || "U";
                const canKickMember =
                  room?.isHost && member.role !== "host" && !isCurrentUser;

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-card/70 p-3 dark:border-white/5 dark:bg-black/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {avatarLabel}
                      </div>
                      <span className="text-sm font-medium">
                        {displayName}
                        {isCurrentUser ? " (you)" : ""}
                        {member.role === "host" && (
                          <span className="ml-2 text-[10px] text-primary">
                            HOST
                          </span>
                        )}
                      </span>
                    </div>

                    {canKickMember ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg px-3"
                        onClick={() => void handleKickMember(member.userId)}
                        disabled={kickingMemberId === member.userId}
                      >
                        {kickingMemberId === member.userId
                          ? "Kicking..."
                          : "Kick"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowSettingsModal(false)}
              className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
            >
              Cancel
            </Button>
            {room?.isHost && (
              <Button
                type="submit"
                className="flex-1 rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.2)] hover:shadow-[0_0_20px_rgba(232,121,249,0.3)] transition-all"
                disabled={!editTitle.trim() || editTitle === room.title}
              >
                Save
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
