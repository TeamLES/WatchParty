"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CopyIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  PlayIcon,
  RefreshCwIcon,
  SendIcon,
  SettingsIcon,
  Share2Icon,
  TrashIcon,
  PanelRightCloseIcon,
  ShuffleIcon,
  UserCheckIcon,
  UsersIcon,
  ChevronDownIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  AuthMeResponse,
  CreateHighlightRequest,
  CreateHighlightResponse,
  GetHighlightsResponse,
  GetRoomAttendeesResponse,
  GetRoomResponse,
  HighlightResponse,
  RoomMemberResponse,
  RsvpRoomResponse,
  RoomRoleUpdatedEvent,
  ChatMessageEvent,
  ReactionEvent,
  UpdateHighlightRequest,
  UpdateHighlightResponse,
} from "@watchparty/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  SyncedYouTubePlayer,
  type SyncedYouTubePlayerRef,
} from "@/components/app/synced-youtube-player";
import { HighlightRecorderModal } from "@/components/app/highlight-recorder-modal";
import { HighlightPlayerModal } from "@/components/app/highlight-player-modal";
import { HighlightsSection } from "@/components/app/highlights-section";
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

function formatScheduledDateTime(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAttendanceStatus(
  status: RoomMemberResponse["rsvpStatus"] | null | undefined,
): string {
  switch (status) {
    case "going":
      return "Going";
    case "not_going":
      return "Not going";
    case "maybe":
      return "Maybe";
    default:
      return "No response";
  }
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
  const [startPlaybackSignal, setStartPlaybackSignal] = useState(0);
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
  const [settingCoHostUserId, setSettingCoHostUserId] = useState<string | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenChatOpen, setIsFullscreenChatOpen] = useState(false);
  const [isAttendeesOpen, setIsAttendeesOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [highlights, setHighlights] = useState<HighlightResponse[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [isRefreshingHighlights, setIsRefreshingHighlights] = useState(false);
  const [showHighlightRecorderModal, setShowHighlightRecorderModal] =
    useState(false);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const [isHighlightSaved, setIsHighlightSaved] = useState(false);
  const [highlightCapturePositionMs, setHighlightCapturePositionMs] = useState<
    number | null
  >(null);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(
    null,
  );
  const [editingHighlight, setEditingHighlight] =
    useState<HighlightResponse | null>(null);
  const [highlightEditTitle, setHighlightEditTitle] = useState("");
  const [highlightEditNote, setHighlightEditNote] = useState("");
  const [isSavingHighlightEdit, setIsSavingHighlightEdit] = useState(false);
  const [lastKnownPositionMs, setLastKnownPositionMs] = useState(0);
  const [attendees, setAttendees] = useState<RoomMemberResponse[]>([]);
  const [isUpdatingRsvp, setIsUpdatingRsvp] = useState(false);
  const [playingHighlight, setPlayingHighlight] = useState<{
    highlight: HighlightResponse;
    shouldRender: boolean;
    animateIn: boolean;
  } | null>(null);

  const socketPlayerRef = useRef<SyncedYouTubePlayerRef>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasLeftRoomRef = useRef(false);
  const roomRef = useRef<GetRoomResponse | null>(null);
  const router = useRouter();

  const fetchRoomSnapshot = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Failed to fetch room");
    }

    return (await res.json()) as GetRoomResponse;
  }, [roomId]);

  const fetchHighlights = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true;

      if (showLoading) {
        setIsLoadingHighlights(true);
      }

      try {
        const res = await fetch(`/api/rooms/${roomId}/highlights`, {
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("Failed to fetch highlights");
          return;
        }

        const data = (await res.json()) as GetHighlightsResponse;
        setHighlights(data.highlights);
      } catch (error) {
        console.error(error);
      } finally {
        if (showLoading) {
          setIsLoadingHighlights(false);
        }
      }
    },
    [roomId],
  );

  const fetchAttendees = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/attendees`, {
        cache: "no-store",
      });

      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as GetRoomAttendeesResponse;
      setAttendees(data.attendees);
    } catch (error) {
      console.error("Failed to fetch attendees", error);
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

  const getMemberDisplayNameById = useCallback(
    (userId: string) => {
      const member = roomRef.current?.members.find(
        (candidate) => candidate.userId === userId,
      );

      if (member) {
        return formatMemberDisplayName(member);
      }

      if (userId.startsWith("guest-")) {
        return `Guest ${userId.slice(-4)}`;
      }

      return `User ${userId.slice(0, 8)}`;
    },
    [formatMemberDisplayName],
  );

  const applyRoomSnapshot = useCallback(
    (nextRoom: GetRoomResponse, options: { notify?: boolean } = {}) => {
      const shouldNotify = options.notify ?? true;
      const previousRoom = roomRef.current;

      if (shouldNotify && previousRoom && currentUserId) {
        const previousCurrentMember = previousRoom.members.find(
          (member) => member.userId === currentUserId,
        );
        const nextCurrentMember = nextRoom.members.find(
          (member) => member.userId === currentUserId,
        );

        if (
          previousCurrentMember?.role !== "co-host" &&
          nextCurrentMember?.role === "co-host"
        ) {
          toast.success("You are now Co-Host", {
            description: "You can control playback and kick viewers.",
          });
        }

        const previousHostWasPresent = previousRoom.members.some(
          (member) => member.userId === previousRoom.hostUserId,
        );
        const nextHostIsPresent = nextRoom.members.some(
          (member) => member.userId === nextRoom.hostUserId,
        );

        if (
          previousHostWasPresent &&
          !nextHostIsPresent &&
          currentUserId !== nextRoom.hostUserId
        ) {
          toast.info("Host left the room", {
            description:
              nextRoom.isController || nextCurrentMember?.role === "co-host"
                ? "You can keep playback moving."
                : "A Co-Host can keep playback moving.",
          });
        }
      }

      roomRef.current = nextRoom;
      setRoom(nextRoom);
    },
    [currentUserId],
  );

  // Fetch initial room data and current user.
  useEffect(() => {
    async function fetchRoom() {
      try {
        const [initialRoomData, meResponse] = await Promise.all([
          fetchRoomSnapshot(),
          fetch("/api/me", { cache: "no-store" }),
        ]);

        if (meResponse.ok) {
          const me = (await meResponse.json()) as AuthMeResponse;
          setCurrentUserId(me.sub);
        }

        let roomData = initialRoomData;

        console.log("Room INFO (vrátené z API):", roomData);
        console.log("Video URL tejto roomky:", roomData.videoUrl);

        if (!roomData.isMember) {
          if (!roomData.isHost) {
            router.replace(`/room/join/${roomId}`);
            return;
          }

          const activateHostResponse = await fetch(
            `/api/rooms/${roomId}/join`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          );

          if (!activateHostResponse.ok) {
            router.replace(`/room/join/${roomId}`);
            return;
          }

          roomData = await fetchRoomSnapshot();
        }

        applyRoomSnapshot(roomData, { notify: false });

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
  }, [applyRoomSnapshot, fetchRoomSnapshot, roomId, router]);

  const hasRoomLoaded = room !== null;

  useEffect(() => {
    if (!hasRoomLoaded) {
      return;
    }

    void fetchHighlights({ showLoading: true });
    if (room?.isScheduled) {
      void fetchAttendees();
    }
  }, [fetchAttendees, fetchHighlights, hasRoomLoaded, room?.isScheduled]);

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

  // Refresh room watchers and counts periodically while the page is open.
  useEffect(() => {
    if (!hasRoomLoaded) {
      return;
    }

    const refreshRoom = async () => {
      try {
        const latestRoom = await fetchRoomSnapshot();

        if (!latestRoom.isMember) {
          if (!latestRoom.isHost) {
            router.replace(`/room/join/${roomId}`);
            return;
          }

          const activateHostResponse = await fetch(
            `/api/rooms/${roomId}/join`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          );

          if (!activateHostResponse.ok) {
            router.replace(`/room/join/${roomId}`);
            return;
          }

          const reactivatedRoom = await fetchRoomSnapshot();
          applyRoomSnapshot(reactivatedRoom, { notify: false });
          if (reactivatedRoom.videoUrl) {
            setVideoUrl(reactivatedRoom.videoUrl);
            setActiveVideoId(extractYoutubeId(reactivatedRoom.videoUrl));
          }
          return;
        }

        applyRoomSnapshot(latestRoom);

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
  }, [applyRoomSnapshot, fetchRoomSnapshot, hasRoomLoaded, roomId, router]);

  const shouldTrackLeave = room?.isMember === true;

  // Best-effort active-seat release on tab close/navigation.
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
      toast.error("Only the Host can change the video");
      return;
    }

    const id = extractYoutubeId(videoUrl);
    if (!id) {
      toast.warning("Paste a valid YouTube URL");
      return;
    }

    if (id === activeVideoId && extractYoutubeId(room.videoUrl) === id) {
      const didRequestPlayback =
        socketPlayerRef.current?.requestPlayForEveryone() ?? false;

      if (!didRequestPlayback) {
        toast.error("Video sync is not ready yet");
        return;
      }

      toast.success("Video started for everyone");
      return;
    }

    setIsUpdatingVideo(true);

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const responseText = await res.text();

      if (!res.ok) {
        let details = "";
        let message = "Could not start the video. Check the link and try again.";

        try {
          const errorBody = JSON.parse(responseText) as { message?: unknown };
          if (typeof errorBody.message === "string") {
            details = errorBody.message;
          } else if (Array.isArray(errorBody.message)) {
            details = errorBody.message.join(" ");
          }
        } catch {
          if (responseText.trim()) {
            details = responseText;
          }
        }

        if (res.status === 403) {
          message = "Only the host can start the video.";
        } else if (details.toLowerCase().includes("url")) {
          message = "Paste a valid YouTube URL and try again.";
        } else if (res.status >= 500) {
          message = "Video could not be started because the server is unavailable.";
        }

        console.error("Failed to update room video", res.status, responseText);
        toast.error(message);
        return;
      }

      if (responseText) {
        const updatedRoom = JSON.parse(responseText) as GetRoomResponse;
        applyRoomSnapshot(updatedRoom, { notify: false });
      }

      setActiveVideoId(id);
      setStartPlaybackSignal((value) => value + 1);
      toast.success("Video started for everyone");
    } catch (err) {
      console.error(err);
      toast.error("Could not change the video");
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

  const handleRsvp = async (status: "going" | "not_going") => {
    setIsUpdatingRsvp(true);

    try {
      const res = await fetch(`/api/rooms/${roomId}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to update attendance", res.status, text);
        toast.error("Could not update attendance");
        return;
      }

      const data = (await res.json()) as RsvpRoomResponse;
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              members: [
                ...prev.members.filter(
                  (member) => member.userId !== data.member.userId,
                ),
                data.member,
              ],
              isMember: true,
            }
          : prev,
      );
      roomRef.current = roomRef.current
        ? {
            ...roomRef.current,
            members: [
              ...roomRef.current.members.filter(
                (member) => member.userId !== data.member.userId,
              ),
              data.member,
            ],
            isMember: true,
          }
        : roomRef.current;
      await fetchAttendees();
      toast.success("Attendance updated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update attendance");
    } finally {
      setIsUpdatingRsvp(false);
    }
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

  const handleRoomRoleUpdated = useCallback(
    (event: RoomRoleUpdatedEvent) => {
      const previousRoom = roomRef.current;

      if (!previousRoom || previousRoom.roomId !== event.roomId) {
        return;
      }

      const isCoHost = currentUserId === event.coHostUserId;

      applyRoomSnapshot({
        ...previousRoom,
        coHostUserId: event.coHostUserId,
        members: event.members,
        isCoHost,
        isController: previousRoom.isHost || isCoHost,
      });
    },
    [applyRoomSnapshot, currentUserId],
  );

  const handleOnlineCountChange = useCallback((onlineCount: number | null) => {
    setRoom((prev) => (prev ? { ...prev, onlineCount } : prev));
    roomRef.current = roomRef.current
      ? { ...roomRef.current, onlineCount }
      : roomRef.current;
  }, []);

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
      toast.error("Could not copy invite link", {
        description: "The invite link is still visible in the dialog.",
      });
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
        console.error("Nepodarilo sa zmazať roomku.");
        toast.error("Could not delete the room");
        return;
      }

      toast.success("Room deleted");
      router.push("/hub");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the room");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleReaction = (emoji: string) => {
    socketPlayerRef.current?.sendReaction(emoji);
  };

  const handleRefreshHighlights = async () => {
    setIsRefreshingHighlights(true);

    try {
      await fetchHighlights({ showLoading: false });
    } finally {
      setIsRefreshingHighlights(false);
    }
  };

  const readCurrentPlaybackPositionMs = useCallback(() => {
    return Math.max(
      0,
      socketPlayerRef.current?.getCurrentPositionMs() ?? lastKnownPositionMs,
    );
  }, [lastKnownPositionMs]);

  const openHighlightRecorder = () => {
    setHighlightCapturePositionMs(readCurrentPlaybackPositionMs());
    setIsHighlightSaved(false);
    setShowHighlightRecorderModal(true);
  };

  const closeHighlightRecorder = () => {
    setShowHighlightRecorderModal(false);
    setHighlightCapturePositionMs(null);
    setIsHighlightSaved(false);
  };

  const handleCreateHighlight = async (config: {
    backSeconds: number;
    title?: string;
  }) => {
    const currentPositionMs =
      highlightCapturePositionMs ?? readCurrentPlaybackPositionMs();

    if (!activeVideoId || currentPositionMs <= 0) {
      toast.warning("Start the video before saving a highlight");
      return;
    }

    setIsCreatingHighlight(true);

    try {
      const backMs = config.backSeconds * 1000;
      const payload: CreateHighlightRequest = {
        startMs: Math.max(0, currentPositionMs - backMs),
        endMs: currentPositionMs,
        title:
          config.title || `Highlight at ${formatDurationMs(currentPositionMs)}`,
      };
      const res = await fetch(`/api/rooms/${roomId}/highlights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to create highlight", res.status, errorText);
        toast.error("Could not save highlight", {
          description: res.statusText,
        });
        return;
      }

      const created = (await res.json()) as CreateHighlightResponse;
      setHighlights((prev) => [created.highlight, ...prev]);
      setIsHighlightSaved(true);
      toast.success("Highlight saved");
      window.setTimeout(() => {
        setIsHighlightSaved(false);
        setShowHighlightRecorderModal(false);
        setHighlightCapturePositionMs(null);
      }, 2500);
      void fetchHighlights({ showLoading: false });
    } catch (error) {
      console.error(error);
      toast.error("Could not save highlight");
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const openHighlightEditModal = (highlight: HighlightResponse) => {
    setEditingHighlight(highlight);
    setHighlightEditTitle(highlight.title ?? "");
    setHighlightEditNote(highlight.note ?? "");
  };

  const closeHighlightEditModal = () => {
    if (isSavingHighlightEdit) {
      return;
    }

    setEditingHighlight(null);
    setHighlightEditTitle("");
    setHighlightEditNote("");
  };

  const handleUpdateHighlight = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingHighlight) {
      return;
    }

    setIsSavingHighlightEdit(true);

    try {
      const payload: UpdateHighlightRequest = {
        title: highlightEditTitle,
        note: highlightEditNote,
      };
      const res = await fetch(
        `/api/rooms/${roomId}/highlights/${editingHighlight.highlightId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        console.error("Failed to update highlight");
        toast.error("Could not update highlight");
        return;
      }

      const data = (await res.json()) as UpdateHighlightResponse;
      setHighlights((prev) =>
        prev.map((highlight) =>
          highlight.highlightId === data.highlight.highlightId
            ? data.highlight
            : highlight,
        ),
      );
      setEditingHighlight(null);
      setHighlightEditTitle("");
      setHighlightEditNote("");
      toast.success("Highlight updated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update highlight");
    } finally {
      setIsSavingHighlightEdit(false);
    }
  };

  const handlePlayHighlight = (highlight: HighlightResponse) => {
    setPlayingHighlight({
      highlight,
      shouldRender: true,
      animateIn: false,
    });
    requestAnimationFrame(() => {
      setPlayingHighlight((prev) =>
        prev ? { ...prev, animateIn: true } : null,
      );
    });
  };

  const closePlayModal = () => {
    setPlayingHighlight((prev) =>
      prev ? { ...prev, animateIn: false } : null,
    );
    setTimeout(() => {
      setPlayingHighlight(null);
    }, 220);
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    setDeletingHighlightId(highlightId);

    try {
      const res = await fetch(
        `/api/rooms/${roomId}/highlights/${highlightId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        console.error("Failed to delete highlight");
        toast.error("Could not delete highlight");
        return;
      }

      setHighlights((prev) =>
        prev.filter((highlight) => highlight.highlightId !== highlightId),
      );
      toast.success("Highlight deleted");
      void fetchHighlights({ showLoading: false });
    } catch (error) {
      console.error(error);
      toast.error("Could not delete highlight");
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

      if (!res.ok) {
        console.error("Failed to update room title");
        toast.error("Could not update room settings");
        return;
      }

      const updatedRoom = (await res.json()) as GetRoomResponse;
      applyRoomSnapshot(updatedRoom, { notify: false });
      setEditTitle(updatedRoom.title);
      setShowSettingsModal(false);
      toast.success("Room settings updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not update room settings");
    }
  };

  const handleKickMember = async (memberUserId: string) => {
    if (!room?.isController) {
      toast.error("You cannot kick members");
      return;
    }

    const memberName = getMemberDisplayNameById(memberUserId);
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
        console.error("Failed to kick member");
        toast.error(`Could not kick ${memberName}`);
        return;
      }

      const latestRoom = await fetchRoomSnapshot();
      applyRoomSnapshot(latestRoom);
      toast.success(`${memberName} was kicked`);
    } catch (error) {
      console.error(error);
      toast.error(`Could not kick ${memberName}`);
    } finally {
      setKickingMemberId(null);
    }
  };

  const handleSetCoHost = async (memberUserId?: string) => {
    if (!room?.isHost) {
      toast.error("Only the Host can choose a Co-Host");
      return;
    }

    const targetName = memberUserId
      ? getMemberDisplayNameById(memberUserId)
      : "a random member";
    setSettingCoHostUserId(memberUserId ?? "random");

    try {
      const res = await fetch(`/api/rooms/${roomId}/co-host`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(memberUserId ? { userId: memberUserId } : {}),
      });

      if (!res.ok) {
        console.error("Failed to set co-host");
        toast.error("Could not update the Co-Host");
        return;
      }

      const latestRoom = (await res.json()) as GetRoomResponse;
      applyRoomSnapshot(latestRoom);
      const coHostName = latestRoom.coHostUserId
        ? getMemberDisplayNameById(latestRoom.coHostUserId)
        : targetName;
      toast.success("Co-Host updated", {
        description: latestRoom.coHostUserId
          ? `${coHostName} can now control playback.`
          : "No eligible member was available.",
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not update the Co-Host");
    } finally {
      setSettingCoHostUserId(null);
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

  const canControlPlayback = room.isController;
  const canManageRoomVideo = room.isHost;
  const watchingCount = Math.max(
    room.activeWatcherCount,
    room.onlineCount ?? 0,
    room.isMember ? 1 : 0,
  );
  const highlightPreviewEndMs =
    highlightCapturePositionMs ?? lastKnownPositionMs;

  return (
    <div className="page-surface relative min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_95%,rgba(192,132,252,0.12),transparent_50%)] pt-4 font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.16),transparent_42%),radial-gradient(circle_at_50%_95%,rgba(192,132,252,0.14),transparent_52%)]">
      {/* Main Workspace */}
      <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 sm:gap-6 sm:px-6 lg:h-[calc(100vh-4rem-1rem)] lg:flex-row lg:overflow-hidden">
        {/* Video Column (Main Content) */}
        <section className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
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
                    {room.isCoHost && !room.isHost && (
                      <span className="text-[10px] bg-emerald-400/15 text-emerald-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Co-Host
                      </span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {room.maxCapacity === null
                        ? watchingCount === 0
                          ? "No one watching"
                          : watchingCount === 1
                            ? "1 watching"
                            : `${watchingCount} watching`
                        : `${watchingCount} / ${room.maxCapacity} watching`}
                    </p>
                    {!canControlPlayback && (
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

            {/* Bottom row: Video Control Panel */}
            {canManageRoomVideo && (
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

            {room.isScheduled && (
              <div className="border-t border-border/50 pt-4 dark:border-white/5">
                <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary">
                      Scheduled for
                    </p>
                    <p className="text-base font-bold">
                      {formatScheduledDateTime(room.scheduledStartAt)}
                    </p>
                    {room.scheduledDescription && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {room.scheduledDescription}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["going", "not_going"] as const).map(
                      (status) => {
                        const label =
                          status === "going"
                            ? "I'm going"
                            : "Not going";
                        const active = room.members.some(
                          (member) =>
                            member.userId === currentUserId &&
                            member.rsvpStatus === status,
                        );

                        return (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className="rounded-xl"
                            disabled={isUpdatingRsvp}
                            onClick={() => void handleRsvp(status)}
                          >
                            {label}
                          </Button>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video Player */}
          <div className="glass-card panel-surface relative min-h-[22rem] flex-1 overflow-hidden rounded-3xl shadow-2xl lg:min-h-0">
            <SyncedYouTubePlayer
              ref={socketPlayerRef}
              roomId={roomId}
              videoId={activeVideoId}
              isHost={canControlPlayback}
              startPlaybackSignal={startPlaybackSignal}
              onRemoteVideoId={(nextVideoId) => {
                setActiveVideoId(nextVideoId);
                setVideoUrl(`https://www.youtube.com/watch?v=${nextVideoId}`);
              }}
              onChatEvent={handleChatEvent}
              onRoomRoleUpdated={handleRoomRoleUpdated}
              onOnlineCountChange={handleOnlineCountChange}
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
        <aside className="w-full lg:w-96 xl:w-100 flex flex-col shrink-0 gap-4 max-h-[calc(100vh-8rem)] pb-2">
          {!isFullscreen && (
            <>
              {room.isScheduled && room.isController && (
                <div className="glass-card panel-surface flex flex-col overflow-hidden shadow-lg rounded-3xl">
                  <div
                    className="flex shrink-0 items-center justify-between border-b border-border/60 bg-accent/40 p-4 dark:border-white/10 dark:bg-black/10 cursor-pointer group"
                    onClick={() => setIsAttendeesOpen((prev) => !prev)}
                  >
                    <div className="flex items-center gap-2">
                      <UsersIcon className="size-5 text-primary" />
                      <h2 className="font-semibold text-lg text-foreground">
                        Attendees
                        <span className="ml-2 rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-black/20">
                          {attendees.length}
                        </span>
                      </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-primary/20 bg-background/60 text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          void fetchAttendees();
                        }}
                        title="Refresh attendees"
                        aria-label="Refresh attendees"
                      >
                        <RefreshCwIcon className="size-3.5" />
                      </Button>
                      <div className={`ml-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary ${isAttendeesOpen ? "rotate-180" : ""}`}>
                        <ChevronDownIcon className="size-5" />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isAttendeesOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-2 p-4">
                        {attendees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No attendance responses yet.
                          </p>
                        ) : (
                          attendees.map((member) => {
                            const displayName = formatMemberDisplayName(member);

                            return (
                              <div
                                key={member.userId}
                                className="rounded-xl border border-border/50 bg-card/70 p-3 text-sm dark:border-white/5 dark:bg-black/20"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium">{displayName}</span>
                                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                    {formatAttendanceStatus(member.rsvpStatus)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {member.role === "host" && (
                                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      HOST
                                    </span>
                                  )}
                                  {member.role === "co-host" && (
                                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                                      CO-HOST
                                    </span>
                                  )}
                                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                    {member.reminderEmailStatus === "sent"
                                      ? "REMINDER SENT"
                                      : member.reminderEmailStatus === "failed"
                                        ? "REMINDER FAILED"
                                        : "REMINDER PENDING"}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <HighlightsSection
                highlights={highlights}
                isLoading={isLoadingHighlights}
                currentUserId={currentUserId}
                isHostUser={room.isHost}
                roomMembers={room.members}
                onPlayHighlight={handlePlayHighlight}
                onEditHighlight={openHighlightEditModal}
                onDeleteHighlight={handleDeleteHighlight}
                onRecordHighlight={openHighlightRecorder}
                onRefreshHighlights={() => void handleRefreshHighlights()}
                isRefreshingHighlights={isRefreshingHighlights}
                deletingHighlightId={deletingHighlightId}
                formatMemberDisplayName={(member) =>
                  member.nickname?.trim() ||
                  (member.userId.startsWith("guest-")
                    ? `Guest ${member.userId.slice(-4)}`
                    : `User ${member.userId.slice(0, 8)}`)
                }
              />

              <div className={`glass-card panel-surface flex min-h-0 flex-col overflow-hidden rounded-3xl shadow-lg transition-all duration-300 ${isChatOpen ? "flex-1" : "shrink-0"}`}>
                <div
                  className="flex shrink-0 items-center justify-between border-b border-border/60 bg-accent/40 p-4 dark:border-white/10 dark:bg-black/10 cursor-pointer group"
                  onClick={() => setIsChatOpen((prev) => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquareTextIcon className="size-5 text-primary" />
                    <h2 className="font-semibold text-lg text-foreground">Room Chat</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                      </span>
                      Live
                    </div>
                    <div className={`ml-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary ${isChatOpen ? "rotate-180" : ""}`}>
                      <ChevronDownIcon className="size-5" />
                    </div>
                  </div>
                </div>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out flex-1 min-h-0 ${
                    isChatOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                  style={{ display: isChatOpen ? 'flex' : 'grid', flexDirection: 'column' }}
                >
                  <div className={`flex flex-col overflow-hidden flex-1 ${!isChatOpen && 'invisible'}`}>
                    <div
                      ref={chatContainerRef}
                      className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border dark:scrollbar-thumb-white/10"
                    >
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="mb-1 flex items-baseline gap-2">
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
                          className="absolute right-1 h-10 w-10 rounded-lg text-primary transition-colors hover:bg-primary/20 hover:text-primary"
                          disabled={!newMessage.trim()}
                        >
                          <SendIcon className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </main>

      <HighlightPlayerModal
        playingHighlight={playingHighlight}
        onClose={closePlayModal}
      />

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
        isOpen={editingHighlight !== null}
        onClose={closeHighlightEditModal}
        title="Edit highlight"
      >
        <form onSubmit={handleUpdateHighlight} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              Title
            </label>
            <Input
              value={highlightEditTitle}
              onChange={(event) => setHighlightEditTitle(event.target.value)}
              maxLength={120}
              className="h-11 rounded-xl border-border/70 bg-background/75 focus-visible:ring-primary/50 dark:border-white/10 dark:bg-black/30"
              placeholder="Untitled highlight"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              Note
            </label>
            <textarea
              value={highlightEditNote}
              onChange={(event) => setHighlightEditNote(event.target.value)}
              maxLength={500}
              className="min-h-28 w-full resize-none rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary/30 dark:border-white/10 dark:bg-black/30"
              placeholder="Add a note..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeHighlightEditModal}
              disabled={isSavingHighlightEdit}
              className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSavingHighlightEdit}
              className="flex-1 rounded-xl"
            >
              {isSavingHighlightEdit ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm font-semibold text-muted-foreground">
                Active Watchers (
                {room?.maxCapacity === null
                  ? watchingCount
                  : `${watchingCount} / ${room?.maxCapacity}`}
                )
              </label>
              {room?.isHost && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => void handleSetCoHost()}
                  disabled={settingCoHostUserId !== null}
                >
                  <ShuffleIcon className="mr-1.5 size-3.5" />
                  {settingCoHostUserId === "random"
                    ? "Choosing..."
                    : "Random Co-Host"}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 max-h-50 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {(room?.members ?? []).map((member) => {
                const isCurrentUser = currentUserId === member.userId;
                const displayName = formatMemberDisplayName(member);
                const avatarLabel = displayName.charAt(0).toUpperCase() || "U";
                const canKickMember =
                  !isCurrentUser &&
                  ((room?.isHost && member.role !== "host") ||
                    (room?.isCoHost && member.role === "viewer"));
                const canMakeCoHost =
                  room?.isHost &&
                  member.role === "viewer" &&
                  member.userId !== room.hostUserId;

                return (
                  <div
                    key={member.userId}
                    className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 p-3 dark:border-white/5 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {avatarLabel}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {displayName}
                          {isCurrentUser ? " (you)" : ""}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {member.role === "host" && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              HOST
                            </span>
                          )}
                          {member.role === "co-host" && (
                            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                              CO-HOST
                            </span>
                          )}
                          {member.role === "viewer" && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              VIEWER
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {canMakeCoHost ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={() => void handleSetCoHost(member.userId)}
                          disabled={settingCoHostUserId !== null}
                        >
                          <UserCheckIcon className="mr-1.5 size-3.5" />
                          {settingCoHostUserId === member.userId
                            ? "Setting..."
                            : "Make Co-Host"}
                        </Button>
                      ) : null}
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

      <HighlightRecorderModal
        isOpen={showHighlightRecorderModal}
        onClose={closeHighlightRecorder}
        onSave={handleCreateHighlight}
        isLoading={isCreatingHighlight}
        isSaved={isHighlightSaved}
        previewEndMs={highlightPreviewEndMs}
      />
    </div>
  );
}
