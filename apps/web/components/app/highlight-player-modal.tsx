"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, XIcon } from "lucide-react";

import { HighlightResponse } from "@watchparty/shared-types";

interface HighlightPlayerModalProps {
  playingHighlight: {
    highlight: HighlightResponse;
    shouldRender: boolean;
    animateIn: boolean;
  } | null;
  onClose: () => void;
}

// Ensure YT interfaces are available here
interface YTPlayer {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
}

interface HighlightYouTubePlayerConfig {
  videoId: string;
  playerVars: {
    autoplay: number;
    controls: number;
    modestbranding: number;
    rel: number;
    fs: number;
    start: number;
  };
  events: {
    onReady: (event: { target: YTPlayer }) => void;
    onStateChange: (event: { data: number }) => void;
  };
}

interface HighlightYouTubeApi {
  Player: new (
    element: HTMLElement,
    config: HighlightYouTubePlayerConfig,
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

function getYouTubeApi(): HighlightYouTubeApi | undefined {
  return window.YT as unknown as HighlightYouTubeApi | undefined;
}

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

export function HighlightPlayerModal({
  playingHighlight,
  onClose,
}: HighlightPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const playingHighlightRef = useRef<HighlightResponse | null>(null);

  // YouTube IFrame API: load once
  useEffect(() => {
    if (getYouTubeApi()) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);

    window.onYouTubeIframeAPIReady = () => {
      // ready
    };
  }, []);

  // Create/destroy player when modal opens/closes or when highlight changes
  useEffect(() => {
    let didCancel = false;
    const updatePlaybackUi = (
      nextPlayerReady: boolean,
      nextIsPlaying: boolean,
      nextCurrentTime: number,
    ) => {
      window.setTimeout(() => {
        if (didCancel) {
          return;
        }

        setPlayerReady(nextPlayerReady);
        setIsPlaying(nextIsPlaying);
        setCurrentTime(nextCurrentTime);
      }, 0);
    };

    if (!playingHighlight?.highlight) {
      playingHighlightRef.current = null;
      updatePlaybackUi(false, false, 0);

      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
      return () => {
        didCancel = true;
      };
    }

    playingHighlightRef.current = playingHighlight.highlight;
    updatePlaybackUi(false, true, 0);

    const highlight = playingHighlight.highlight;

    const ensurePlayer = async () => {
      let youtube = getYouTubeApi();
      // wait until YT is available
      const maxWaitMs = 3000;
      const startedAt = Date.now();
      while (!youtube?.Player) {
        if (didCancel) {
          return;
        }

        if (Date.now() - startedAt > maxWaitMs) {
          console.error("YouTube IFrame API not ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
        youtube = getYouTubeApi();
      }

      // (re)create
      if (didCancel) {
        return;
      }

      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;

      if (!ytContainerRef.current) return;
      ytContainerRef.current.innerHTML = "";

      playerRef.current = new youtube.Player(ytContainerRef.current, {
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
            if (didCancel) {
              return;
            }

            try {
              event.target.seekTo(highlight.startMs / 1000, true);
              event.target.playVideo();
              setPlayerReady(true);
              setIsPlaying(true);
            } catch (err) {
              console.error("YT onReady error", err);
            }
          },
          onStateChange: (event: { data: number }) => {
            if (didCancel) {
              return;
            }

            const ps = youtube.PlayerState;
            if (!ps) return;
            if (event.data === ps.PAUSED) setIsPlaying(false);
            if (event.data === ps.PLAYING) setIsPlaying(true);
          },
        },
      });

      // player is now stored in playerRef.current
    };

    void ensurePlayer();

    return () => {
      didCancel = true;
    };
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
      const state = player.getPlayerState?.();
      // YT.PlayerState might not be directly on w.YT if not fully loaded, but we checked playerReady
      const playingState = getYouTubeApi()?.PlayerState?.PLAYING ?? 1;

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

  if (!playingHighlight?.shouldRender) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200 ${
        playingHighlight.animateIn
          ? "bg-black/40 opacity-100"
          : "bg-black/0 opacity-0 pointer-events-none"
      } backdrop-blur-sm`}
      onClick={onClose}
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
            onClick={onClose}
            className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            title="Close"
          >
            <XIcon className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
