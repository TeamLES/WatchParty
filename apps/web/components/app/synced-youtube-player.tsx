"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  MonitorPlayIcon,
  Maximize2Icon,
  Minimize2Icon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import type {
  PlaybackEventKind,
  PlaybackSnapshotEvent,
  PlaybackSyncEvent,
  WatchPartyOutboundWebSocketEvent,
  WebSocketTicketResponse,
  WatchPartyPlaybackState,
} from "@watchparty/shared-types";

import { Button } from "@/components/ui/button";

type PlaybackState = WatchPartyPlaybackState;
type SocketStatus = "idle" | "connecting" | "connected" | "unavailable";

interface SyncedYouTubePlayerProps {
  roomId: string;
  videoId: string | null;
  isHost: boolean;
}

interface YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  isMuted(): boolean;
  pauseVideo(): void;
  playVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
}

interface YouTubePlayerOptions {
  videoId: string;
  height?: string;
  width?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YouTubePlayerEvent) => void;
  };
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();

      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      reject(new Error("YouTube API did not initialize"));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load YouTube API"));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function buildWebSocketUrl(wsUrl: string, ticket: string): string {
  const url = new URL(wsUrl);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function createEventId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseSocketEvent(
  value: string,
): WatchPartyOutboundWebSocketEvent | null {
  try {
    const parsed = JSON.parse(value) as WatchPartyOutboundWebSocketEvent;

    return parsed && typeof parsed === "object" && "type" in parsed
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function SyncedYouTubePlayer({
  roomId,
  videoId,
  isHost,
}: SyncedYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerMountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);
  const sequenceRef = useRef(0);
  const positionMsRef = useRef(0);
  const durationMsRef = useRef(0);
  const playbackStateRef = useRef<PlaybackState>("paused");
  const volumeRef = useRef(100);
  const mutedRef = useRef(false);
  const playerReadyRef = useRef(false);
  const isHostRef = useRef(isHost);
  const sendPlaybackEventRef = useRef<typeof sendPlaybackEvent | null>(null);

  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("paused");
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const syncLabel = useMemo(() => {
    if (socketStatus === "connected") {
      return onlineCount === null ? "Live sync" : `Live sync (${onlineCount})`;
    }

    if (socketStatus === "connecting") {
      return "Connecting";
    }

    return "Sync offline";
  }, [onlineCount, socketStatus]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    positionMsRef.current = positionMs;
  }, [positionMs]);

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    playerReadyRef.current = playerReady;
  }, [playerReady]);

  const readPositionMs = useCallback(() => {
    const player = playerRef.current;

    if (!player) {
      return positionMsRef.current;
    }

    try {
      return Math.max(0, Math.round(player.getCurrentTime() * 1000));
    } catch {
      return positionMsRef.current;
    }
  }, []);

  const refreshPlayerClock = useCallback(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    try {
      const nextPositionMs = Math.max(
        0,
        Math.round(player.getCurrentTime() * 1000),
      );
      const nextDurationMs = Math.max(
        0,
        Math.round(player.getDuration() * 1000),
      );

      setPositionMs(nextPositionMs);
      setDurationMs(nextDurationMs);
    } catch {
      // The player can briefly throw while the iframe is switching videos.
    }
  }, []);

  const applySavedVolumeToPlayer = useCallback(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const nextVolume = Math.max(0, Math.min(100, volumeRef.current));

    try {
      player.setVolume(nextVolume);

      if (mutedRef.current || nextVolume === 0) {
        player.mute();
        mutedRef.current = true;
        setIsMuted(true);
      } else {
        player.unMute();
        mutedRef.current = false;
        setIsMuted(false);
      }

      setVolume(nextVolume);
    } catch {
      // Volume changes can fail briefly while the iframe is reinitializing.
    }
  }, []);

  const sendSocketMessage = useCallback((payload: unknown) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendPlaybackEvent = useCallback(
    (
      eventType: PlaybackEventKind,
      stateOverride?: PlaybackState,
      positionOverrideMs?: number,
    ) => {
      if (!isHostRef.current || !playerReadyRef.current) {
        return false;
      }

      const nextSequence = sequenceRef.current + 1;
      const state = stateOverride ?? playbackStateRef.current;
      const nextPositionMs = positionOverrideMs ?? readPositionMs();

      sequenceRef.current = nextSequence;
      setPlaybackState(state);
      setPositionMs(nextPositionMs);

      return sendSocketMessage({
        action: "syncPlayback",
        roomId,
        sequence: nextSequence,
        eventType,
        state,
        positionMs: nextPositionMs,
        eventId: createEventId(),
        sentAt: new Date().toISOString(),
      });
    },
    [readPositionMs, roomId, sendSocketMessage],
  );

  useEffect(() => {
    sendPlaybackEventRef.current = sendPlaybackEvent;
  }, [sendPlaybackEvent]);

  const applyRemotePlayback = useCallback(
    (event: PlaybackSnapshotEvent | PlaybackSyncEvent) => {
      if (
        isHostRef.current ||
        !playerReadyRef.current ||
        event.roomId !== roomId
      ) {
        return;
      }

      const player = playerRef.current;
      if (!player) {
        return;
      }

      const elapsedMs =
        event.state === "playing"
          ? Math.max(0, Date.now() - Date.parse(event.updatedAt))
          : 0;
      const targetPositionMs = Math.max(0, event.positionMs + elapsedMs);
      const currentPositionMs = readPositionMs();
      const driftMs = Math.abs(currentPositionMs - targetPositionMs);
      const shouldSeek = driftMs > 1500 || event.type === "playback.snapshot";

      applyingRemoteRef.current = true;

      try {
        if (shouldSeek) {
          player.seekTo(targetPositionMs / 1000, true);
        }

        if (event.state === "playing") {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } finally {
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 500);
      }

      setPlaybackState(event.state);
      setPositionMs(targetPositionMs);
      sequenceRef.current = Math.max(sequenceRef.current, event.sequence);
    },
    [readPositionMs, roomId],
  );

  const handleSocketEvent = useCallback(
    (event: MessageEvent<string>) => {
      const message = parseSocketEvent(event.data);

      if (!message) {
        return;
      }

      if (message.type === "error") {
        setSocketError(message.message);
        return;
      }

      if (message.type === "presence.updated" && message.roomId === roomId) {
        setOnlineCount(message.onlineCount);
        return;
      }

      if (
        (message.type === "playback.snapshot" ||
          message.type === "playback.sync") &&
        message.roomId === roomId
      ) {
        sequenceRef.current = Math.max(sequenceRef.current, message.sequence);
        applyRemotePlayback(message);
      }
    },
    [applyRemotePlayback, roomId],
  );

  useEffect(() => {
    let didUnmount = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = async () => {
      clearReconnectTimer();
      setSocketStatus("connecting");
      setSocketError(null);

      try {
        const response = await fetch("/api/realtime/ws-ticket", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Realtime sync is unavailable");
        }

        const ticket = (await response.json()) as WebSocketTicketResponse;

        if (didUnmount) {
          return;
        }

        const socket = new WebSocket(
          buildWebSocketUrl(ticket.wsUrl, ticket.ticket),
        );
        socketRef.current = socket;

        socket.onopen = () => {
          setSocketStatus("connected");
          setSocketError(null);
          sendSocketMessage({ action: "joinRoom", roomId });
          sendSocketMessage({ action: "getPlaybackSnapshot", roomId });
        };
        socket.onmessage = handleSocketEvent;
        socket.onerror = () => {
          setSocketError("Realtime sync connection failed");
        };
        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }

          if (didUnmount) {
            return;
          }

          setSocketStatus("connecting");
          reconnectTimerRef.current = window.setTimeout(connect, 2500);
        };
      } catch (error) {
        if (didUnmount) {
          return;
        }

        setSocketStatus("unavailable");
        setSocketError(
          error instanceof Error
            ? error.message
            : "Realtime sync is unavailable",
        );
      }
    };

    void connect();

    const pingInterval = window.setInterval(() => {
      sendSocketMessage({ action: "ping" });
    }, 30000);

    return () => {
      didUnmount = true;
      clearReconnectTimer();
      window.clearInterval(pingInterval);
      sendSocketMessage({ action: "leaveRoom" });
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [handleSocketEvent, roomId, sendSocketMessage]);

  useEffect(() => {
    const mount = playerMountRef.current;

    if (!mount || !videoId) {
      playerRef.current?.destroy();
      playerRef.current = null;
      setPlayerReady(false);
      setPlaybackState("paused");
      setPositionMs(0);
      setDurationMs(0);
      return;
    }

    let isCancelled = false;
    setPlayerReady(false);
    mount.innerHTML = "";

    void loadYouTubeIframeApi()
      .then((youtube) => {
        if (isCancelled || !playerMountRef.current) {
          return;
        }

        const playerElement = document.createElement("div");
        playerMountRef.current.appendChild(playerElement);

        playerRef.current = new youtube.Player(playerElement, {
          videoId,
          height: "100%",
          width: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: isHost ? 0 : 1,
            fs: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (isCancelled) {
                return;
              }

              setPlayerReady(true);
              applySavedVolumeToPlayer();
              refreshPlayerClock();
              sendSocketMessage({ action: "getPlaybackSnapshot", roomId });
            },
            onStateChange: (event) => {
              if (applyingRemoteRef.current) {
                return;
              }

              if (event.data === youtube.PlayerState.PLAYING) {
                if (playbackStateRef.current !== "playing" && isHostRef.current) {
                  sendPlaybackEventRef.current?.("play", "playing");
                }
                setPlaybackState("playing");
              }

              if (
                event.data === youtube.PlayerState.PAUSED ||
                event.data === youtube.PlayerState.ENDED
              ) {
                if (playbackStateRef.current !== "paused" && isHostRef.current) {
                  sendPlaybackEventRef.current?.("pause", "paused");
                }
                setPlaybackState("paused");
              }

              refreshPlayerClock();
            },
          },
        });
      })
      .catch((error) => {
        console.error(error);
        setPlayerReady(false);
      });

    return () => {
      isCancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      mount.innerHTML = "";
      setPlayerReady(false);
    };
  }, [applySavedVolumeToPlayer, isHost, refreshPlayerClock, roomId, sendSocketMessage, videoId]);

  useEffect(() => {
    if (!playerReady) {
      return;
    }

    const interval = window.setInterval(refreshPlayerClock, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [playerReady, refreshPlayerClock]);

  useEffect(() => {
    if (!isHost || !playerReady) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      if (playbackStateRef.current === "playing") {
        sendPlaybackEvent("position", "playing");
      }
    }, 5000);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [isHost, playerReady, sendPlaybackEvent]);

  const handlePlayPause = () => {
    const player = playerRef.current;

    if (!playerReady || !player || !isHost) {
      return;
    }

    if (playbackState === "playing") {
      player.pauseVideo();
      setPlaybackState("paused");
      sendPlaybackEvent("pause", "paused");
      return;
    }

    player.playVideo();
    setPlaybackState("playing");
    sendPlaybackEvent("play", "playing");
  };

  const seekTo = (nextPositionMs: number) => {
    const player = playerRef.current;

    if (!playerReady || !player || !isHost) {
      return;
    }

    const boundedPositionMs = Math.max(
      0,
      Math.min(nextPositionMs, durationMsRef.current || nextPositionMs),
    );

    player.seekTo(boundedPositionMs / 1000, true);
    setPositionMs(boundedPositionMs);
    sendPlaybackEvent("seek", playbackStateRef.current, boundedPositionMs);
  };

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPositionMs(Number(event.target.value));
  };

  const commitSliderSeek = () => {
    seekTo(positionMsRef.current);
  };

  const handleSliderKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      commitSliderSeek();
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);

    const player = playerRef.current;
    if (!player) {
      return;
    }

    try {
      player.setVolume(nextVolume);

      if (nextVolume === 0) {
        player.mute();
        mutedRef.current = true;
        setIsMuted(true);
        return;
      }

      if (mutedRef.current) {
        player.unMute();
        mutedRef.current = false;
        setIsMuted(false);
      }
    } catch {
      // Ignore transient iframe errors while the player is switching.
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;

    if (!player || !playerReady) {
      return;
    }

    if (mutedRef.current) {
      const restoreVolume = volumeRef.current > 0 ? volumeRef.current : 60;

      try {
        player.unMute();
        player.setVolume(restoreVolume);
        mutedRef.current = false;
        setIsMuted(false);
        setVolume(restoreVolume);
      } catch {
        // Ignore transient iframe errors while the player is switching.
      }

      return;
    }

    try {
      player.mute();
      mutedRef.current = true;
      setIsMuted(true);
    } catch {
      // Ignore transient iframe errors while the player is switching.
    }
  };

  const toggleFullscreen = async () => {
    const fullscreenTarget = containerRef.current;

    if (!fullscreenTarget) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (fullscreenTarget.requestFullscreen) {
        await fullscreenTarget.requestFullscreen();
      }
    } catch {
      // Some browsers require the fullscreen request to come from a direct click.
    }
  };

  const handleResync = () => {
    sendSocketMessage({ action: "getPlaybackSnapshot", roomId });
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeXIcon : volume < 50 ? Volume1Icon : Volume2Icon;

  if (!videoId) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
        <MonitorPlayIcon className="mb-4 size-16 opacity-50" />
        <p className="text-lg font-medium">Nothing playing right now</p>
        <p className="text-sm">Host will start a video soon.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col overflow-hidden bg-black text-white">
      <div className="relative min-h-0 flex-1">
        {!isHost && (
          <div className="absolute inset-0 z-10" title="Only the host can control playback" />
        )}
        <div ref={playerMountRef} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="z-20 shrink-0 border-t border-white/10 bg-zinc-950/95 px-3 py-3 shadow-2xl backdrop-blur sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-300">
          <div className="flex min-w-0 items-center gap-2">
            {socketStatus === "connected" ? (
              <WifiIcon className="size-3.5 shrink-0 text-emerald-400" />
            ) : (
              <WifiOffIcon className="size-3.5 shrink-0 text-amber-300" />
            )}
            <span className="truncate">{socketError ?? syncLabel}</span>
          </div>
          <span className="shrink-0 font-mono">
            {formatTime(positionMs)} / {formatTime(durationMs)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-10 w-10 shrink-0 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-45"
            onClick={handlePlayPause}
            disabled={!isHost || !playerReady}
            title={playbackState === "playing" ? "Pause" : "Play"}
          >
            {playbackState === "playing" ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4 fill-current" />
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-lg text-zinc-200 hover:bg-white/10 hover:text-white disabled:opacity-45"
            onClick={() => seekTo(positionMsRef.current - 10000)}
            disabled={!isHost || !playerReady}
            title="Back 10 seconds"
          >
            <RotateCcwIcon className="size-4" />
          </Button>

          <input
            type="range"
            min={0}
            max={Math.max(durationMs, 1)}
            step={1000}
            value={Math.min(positionMs, Math.max(durationMs, 1))}
            onChange={handleSliderChange}
            onPointerUp={commitSliderSeek}
            onKeyUp={handleSliderKeyUp}
            disabled={!isHost || !playerReady}
            aria-label="Video position"
            className="h-2 min-w-0 flex-1 cursor-pointer accent-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-45"
          />

          <div className="relative flex items-center">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0 rounded-lg text-zinc-200 hover:bg-white/10 hover:text-white disabled:opacity-45"
              onClick={() => setShowVolume((prev) => !prev)}
              disabled={!playerReady}
              title="Volume Controls"
            >
              <VolumeIcon className="size-4" />
            </Button>

            {showVolume && (
              <div className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 flex-col items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex h-24 w-8 items-center justify-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume slider"
                    className="h-2 w-24 -rotate-90 cursor-pointer accent-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-md text-zinc-200 hover:bg-white/10 hover:text-white"
                  onClick={toggleMute}
                  title={isMuted || volume === 0 ? "Unmute" : "Mute"}
                >
                  <VolumeIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-lg text-zinc-200 hover:bg-white/10 hover:text-white"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-4" />
            ) : (
              <Maximize2Icon className="size-4" />
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-lg text-zinc-200 hover:bg-white/10 hover:text-white"
            onClick={handleResync}
            title="Refresh sync"
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
