"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CalendarIcon,
  Edit3Icon,
  FilmIcon,
  SparklesIcon,
  TrashIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import type {
  GetMyHighlightsResponse,
  HighlightResponse,
  UpdateHighlightRequest,
  UpdateHighlightResponse,
} from "@watchparty/shared-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

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

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface PlayingHighlight {
  highlight: HighlightResponse;
  shouldRender: boolean;
  animateIn: boolean;
}

// Minimal YouTube IFrame API types (avoid `any`)
type YTPlayerState = {
  PLAYING: number;
  PAUSED: number;
  ENDED: number;
};

type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

type YouTubeWindow = Window & {
  YT?: {
    Player: new (
      element: HTMLElement,
      options: {
        videoId: string;
        playerVars?: Record<string, string | number | boolean | undefined>;
        events?: {
          onReady?: (event: { target: YTPlayer }) => void;
          onStateChange?: (event: { data: number }) => void;
        };
      },
    ) => YTPlayer;
    PlayerState: YTPlayerState;
  };
  onYouTubeIframeAPIReady?: () => void;
};

export default function MyHighlightsPage() {
  const [highlights, setHighlights] = useState<HighlightResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(
    null,
  );
  const [editingHighlight, setEditingHighlight] =
    useState<HighlightResponse | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [playingHighlight, setPlayingHighlight] =
    useState<PlayingHighlight | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const playingHighlightRef = useRef<HighlightResponse | null>(null);

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await fetch("/api/me/highlights", { cache: "no-store" });

      if (!res.ok) {
        console.error("Failed to fetch highlights");
        return;
      }

      const data = (await res.json()) as GetMyHighlightsResponse;
      setHighlights(data.highlights);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHighlights();
  }, [fetchHighlights]);

  // YouTube IFrame API: load once
  useEffect(() => {
    const w = window as YouTubeWindow;

    if (w.YT) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);

    w.onYouTubeIframeAPIReady = () => {
      // ready
    };
  }, []);

  // Create/destroy player when modal opens/closes or when highlight changes
  useEffect(() => {
    if (!playingHighlight?.highlight) {
      playingHighlightRef.current = null;
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);

      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
      return;
    }

    playingHighlightRef.current = playingHighlight.highlight;
    setPlayerReady(false);
    setIsPlaying(true);
    setCurrentTime(0);

    const highlight = playingHighlight.highlight;

    const ensurePlayer = async () => {
      const w = window as YouTubeWindow;
      // wait until YT is available
      const maxWaitMs = 3000;
      const startedAt = Date.now();
      while (!w.YT || !w.YT.Player) {
        if (Date.now() - startedAt > maxWaitMs) {
          console.error("YouTube IFrame API not ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      // (re)create
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;

      if (!ytContainerRef.current) return;
      ytContainerRef.current.innerHTML = "";

      playerRef.current = new w.YT.Player(ytContainerRef.current, {
        videoId: highlight.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          start: Math.floor(highlight.startMs / 1000),
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            try {
              event.target.seekTo(highlight.startMs / 1000, true);
              event.target.playVideo();
              setPlayerReady(true);
              setIsPlaying(true);
            } catch (err) {
              console.error("YT onReady error", err);
            }
          },
          onStateChange: (event) => {
            const ps = w.YT?.PlayerState;
            if (!ps) return;
            if (event.data === ps.PAUSED) setIsPlaying(false);
            if (event.data === ps.PLAYING) setIsPlaying(true);
          },
        },
      });

      // player is now stored in playerRef.current
    };

    void ensurePlayer();
  }, [playingHighlight]);

  // Sync progress bar with player time
  useEffect(() => {
    if (!playerReady || !playingHighlight?.highlight) return;

    const tick = () => {
      const player = playerRef.current;
      const highlight = playingHighlightRef.current;
      if (!player || !highlight) return;

      try {
        const abs = player.getCurrentTime?.();
        if (typeof abs !== "number") return;

        const startS = highlight.startMs / 1000;
        const endS = highlight.endMs / 1000;
        const rel = Math.max(0, abs - startS);

        // Ensure video is playing if it should be
        if (isPlaying && player.getPlayerState?.() === 2) {
          // 2 is PAUSED in YT API
          player.playVideo?.();
        }

        if (abs >= endS - 0.1) {
          player.pauseVideo?.();
          player.seekTo?.(endS, true);
          setIsPlaying(false);
          setCurrentTime(endS - startS);
          return;
        }

        setCurrentTime(rel);
      } catch {
        // ignore
      }
    };

    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [playerReady, playingHighlight, isPlaying]);

  const handlePlayPause = () => {
    const player = playerRef.current;
    const highlight = playingHighlightRef.current;
    if (!player || !playerReady || !highlight) return;

    try {
      const w = window as YouTubeWindow;
      const state = player.getPlayerState?.();
      // YT.PlayerState might not be directly on w.YT if not fully loaded, but we checked playerReady
      const playingState = w.YT?.PlayerState?.PLAYING ?? 1;

      if (state === playingState) {
        player.pauseVideo?.();
        setIsPlaying(false);
        return;
      }

      // if we are at end, restart from beginning
      const startS = highlight.startMs / 1000;
      const endS = highlight.endMs / 1000;
      const abs = player.getCurrentTime?.();
      if (typeof abs === "number" && abs >= endS - 0.1) {
        player.seekTo?.(startS, true);
        setCurrentTime(0);
      }

      player.playVideo?.();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    const highlight = playingHighlightRef.current;
    if (!player || !playerReady || !highlight) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );

    const clipDurationS = (highlight.endMs - highlight.startMs) / 1000;
    const startS = highlight.startMs / 1000;
    const seekS = startS + ratio * clipDurationS;

    try {
      player.seekTo?.(seekS, true);
      setCurrentTime(ratio * clipDurationS);
      if (!isPlaying) {
        player.playVideo?.();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const total = highlights.length;
    const totalDurationMs = highlights.reduce(
      (sum, highlight) =>
        sum + Math.max(0, highlight.endMs - highlight.startMs),
      0,
    );
    const latest = [...highlights].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    )[0];

    return {
      total,
      totalDurationMs,
      latest,
    };
  }, [highlights]);

  const openEditModal = (highlight: HighlightResponse) => {
    setEditingHighlight(highlight);
    setEditTitle(highlight.title ?? "");
    setEditNote(highlight.note ?? "");
  };

  const closeEditModal = () => {
    if (isSavingEdit) {
      return;
    }

    setEditingHighlight(null);
    setEditTitle("");
    setEditNote("");
  };

  const openPlayModal = (highlight: HighlightResponse) => {
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

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingHighlight) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const payload: UpdateHighlightRequest = {
        title: editTitle,
        note: editNote,
      };
      const res = await fetch(
        `/api/rooms/${editingHighlight.roomId}/highlights/${editingHighlight.highlightId}`,
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
        alert("Unable to update this highlight right now.");
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
      setEditTitle("");
      setEditNote("");
    } catch (error) {
      console.error(error);
      alert("Unable to update this highlight right now.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteHighlight = async (highlight: HighlightResponse) => {
    setDeletingHighlightId(highlight.highlightId);

    try {
      const res = await fetch(
        `/api/rooms/${highlight.roomId}/highlights/${highlight.highlightId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        console.error("Failed to delete highlight");
        alert("Unable to delete this highlight right now.");
        return;
      }

      setHighlights((prev) =>
        prev.filter((item) => item.highlightId !== highlight.highlightId),
      );
    } catch (error) {
      console.error(error);
      alert("Unable to delete this highlight right now.");
    } finally {
      setDeletingHighlightId(null);
    }
  };

  return (
    <main className="page-surface min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.12),transparent_48%)] font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.18),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.16),transparent_50%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-20 sm:p-8">
        {/* Hero Section */}
        <section className="glass-card panel-surface overflow-hidden rounded-[2rem] border border-border/60 shadow-2xl dark:border-white/10">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary shadow-[0_0_24px_rgba(168,85,247,0.18)]">
                <BookmarkIcon className="size-5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                  Your saved clips
                </span>
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground dark:border-white/10 dark:bg-black/20">
                  {stats.total} highlight{stats.total === 1 ? "" : "s"}
                </span>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                My Highlights
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Watch your saved clips, edit titles and notes, or explore
                amazing moments from your watch parties.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-xl border border-primary/20 bg-primary/10 px-4 text-primary hover:bg-primary/20"
              >
                <Link href="/hub">
                  <ArrowLeftIcon className="mr-2 size-4" />
                  Back to Hub
                </Link>
              </Button>
              <Button
                asChild
                className="h-11 rounded-xl px-4 shadow-[0_0_20px_rgba(232,121,249,0.18)] hover:shadow-[0_0_28px_rgba(232,121,249,0.28)]"
              >
                <Link href="/hub">
                  <SparklesIcon className="mr-2 size-4" />
                  Create more clips
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-3 border-t border-border/60 p-4 sm:grid-cols-3 dark:border-white/10 sm:p-6">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saved clips
              </p>
              <p className="mt-2 text-3xl font-black text-foreground">
                {stats.total}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Across all rooms
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total runtime
              </p>
              <p className="mt-2 text-3xl font-black text-foreground">
                {formatDurationMs(stats.totalDurationMs)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                All highlights combined
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Latest clip
              </p>
              <p className="mt-2 truncate text-base font-bold text-foreground">
                {stats.latest?.title ?? "Untitled highlight"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.latest
                  ? formatCreatedAt(stats.latest.createdAt)
                  : "No recent clip"}
              </p>
            </div>
          </div>
        </section>

        {/* Highlights Grid */}
        {isLoading ? (
          <div className="glass-card panel-surface flex min-h-60 items-center justify-center rounded-[2rem] border border-border/60 p-10 text-center text-muted-foreground dark:border-white/10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary/15" />
              <p className="text-sm font-medium">Loading highlights...</p>
            </div>
          </div>
        ) : highlights.length === 0 ? (
          <div className="glass-card panel-surface flex min-h-72 flex-col items-center justify-center rounded-[2rem] border border-border/60 p-8 text-center dark:border-white/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_24px_rgba(168,85,247,0.18)]">
              <FilmIcon className="size-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Nothing saved yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Your highlights will appear here once you save clips from a room.
            </p>
            <Button asChild className="mt-6 rounded-xl px-5">
              <Link href="/hub">Go to Hub</Link>
            </Button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {highlights.map((highlight) => (
              <article
                key={highlight.highlightId}
                className="group overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/80 shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-white/5"
              >
                {/* Thumbnail with Play Button */}
                <button
                  type="button"
                  onClick={() => openPlayModal(highlight)}
                  className="relative h-44 w-full bg-cover bg-center transition-all hover:brightness-110"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.08) 0%, rgba(15,23,42,0.68) 100%), url(https://img.youtube.com/vi/${highlight.videoId}/mqdefault.jpg)`,
                  }}
                >
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    <PlayIcon className="size-3.5 fill-current" />
                    Highlight
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg transition-transform group-hover:scale-110">
                      <PlayIcon className="size-6 fill-primary-foreground text-primary-foreground" />
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 font-mono text-xs text-white backdrop-blur-md">
                    {formatDurationMs(highlight.startMs)} -{" "}
                    {formatDurationMs(highlight.endMs)}
                  </div>
                </button>

                {/* Content */}
                <div className="flex flex-col gap-4 p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold tracking-tight">
                      {highlight.title ?? "Untitled highlight"}
                    </h2>
                    {highlight.note ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {highlight.note}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground/80">
                        No note attached yet.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-xs dark:border-white/10 dark:bg-black/20">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="size-3.5 shrink-0" />
                      {formatCreatedAt(highlight.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4 dark:border-white/10">
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 rounded-xl px-4 gap-2"
                      onClick={() => openPlayModal(highlight)}
                    >
                      <PlayIcon className="size-3.5 fill-current" />
                      Play
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 rounded-xl px-4"
                      onClick={() => openEditModal(highlight)}
                    >
                      <Edit3Icon className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl px-4 text-red-400 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => void handleDeleteHighlight(highlight)}
                      disabled={deletingHighlightId === highlight.highlightId}
                    >
                      <TrashIcon className="mr-2 size-4" />
                      {deletingHighlightId === highlight.highlightId
                        ? "Deleting..."
                        : "Delete"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {/* Play Video Modal */}
      {playingHighlight?.shouldRender && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
            playingHighlight.animateIn
              ? "bg-black/40 opacity-100"
              : "bg-black/0 opacity-0 pointer-events-none"
          } backdrop-blur-sm`}
          onClick={closePlayModal}
        >
          <div
            className={`relative w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl transition-all duration-220 ease-out ${
              playingHighlight.animateIn
                ? "scale-100 opacity-100"
                : "scale-95 opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full bg-black">
              <div ref={ytContainerRef} className="size-full" />

              {/* Custom Progress Bar and Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-8">
                {/* Progress Bar */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold text-white/50 w-10">
                    {formatDurationMs(Math.floor(currentTime * 1000))}
                  </span>
                  <div
                    className="flex-1 h-1.5 bg-white/10 rounded-full relative cursor-pointer group"
                    onClick={handleProgressClick}
                  >
                    {/* Track Background */}
                    <div
                      className="absolute inset-0 h-full bg-primary/40 rounded-full transition-all group-hover:bg-primary/50"
                      style={{
                        width: `${Math.min(100, Math.max(0, (currentTime / ((playingHighlight.highlight.endMs - playingHighlight.highlight.startMs) / 1000)) * 100))}%`,
                      }}
                    />
                    {/* The Thumb/Slider Head */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-primary z-10 opacity-100 transition-transform group-hover:scale-125"
                      style={{
                        left: `calc(${Math.min(100, Math.max(0, (currentTime / ((playingHighlight.highlight.endMs - playingHighlight.highlight.startMs) / 1000)) * 100))}% - 6px)`,
                      }}
                    />
                    {/* Active Track */}
                    <div
                      className="h-full bg-primary rounded-full relative z-0"
                      style={{
                        width: `${Math.min(100, Math.max(0, (currentTime / ((playingHighlight.highlight.endMs - playingHighlight.highlight.startMs) / 1000)) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white/50 w-10 text-right">
                    {formatDurationMs(
                      playingHighlight.highlight.endMs -
                        playingHighlight.highlight.startMs,
                    )}
                  </span>
                </div>

                {/* Info and Controls */}
                <div className="flex items-end justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">
                      {playingHighlight.highlight.title}
                    </h3>
                    {playingHighlight.highlight.note && (
                      <p className="mt-1 text-sm text-white/80 line-clamp-2">
                        {playingHighlight.highlight.note}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="ml-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors shrink-0"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <PlayIcon className="w-5 h-5 fill-current" />
                    )}
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={closePlayModal}
                className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                title="Close"
              >
                <XIcon className="size-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={editingHighlight !== null}
        onClose={closeEditModal}
        title="Edit highlight"
      >
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              Title
            </label>
            <Input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
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
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
              maxLength={500}
              className="min-h-28 w-full resize-none rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary/30 dark:border-white/10 dark:bg-black/30"
              placeholder="Add a note..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditModal}
              disabled={isSavingEdit}
              className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSavingEdit}
              className="flex-1 rounded-xl"
            >
              {isSavingEdit ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
