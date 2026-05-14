"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LockIcon,
  GlobeIcon,
  UsersRoundIcon,
  SearchIcon,
  MonitorPlayIcon,
  CalendarClockIcon,
  ClockIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CreateScheduledRoomResponse,
  RoomSummaryResponse,
} from "@watchparty/shared-types";
import { extractYoutubeId } from "@/lib/youtube";

type RoomActivityFilter = "all" | "active" | "empty";

const getWatchingCount = (room: RoomSummaryResponse) => {
  const count = Number(room.activeWatcherCount);

  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.floor(count));
};

const formatWatchingLabel = (room: RoomSummaryResponse) => {
  if (room.maxCapacity !== null) {
    return `${getWatchingCount(room)} / ${room.maxCapacity} watching`;
  }

  const watchingCount = getWatchingCount(room);

  if (watchingCount === 0) {
    return "No one watching";
  }

  return watchingCount === 1 ? "1 watching" : `${watchingCount} watching`;
};

const formatScheduledStart = (value: string | null) => {
  if (!value) {
    return "Start time not set";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const REMINDER_SEND_BUFFER_MS = 60_000;

const getScheduleReminderError = (
  scheduleDateTime: string,
  reminderMinutes: string,
  nowMs: number | null,
): string | null => {
  if (!scheduleDateTime || !reminderMinutes.trim() || nowMs === null) {
    return null;
  }

  const startAt = new Date(scheduleDateTime);
  if (Number.isNaN(startAt.getTime())) {
    return null;
  }

  const parsedReminder = Number(reminderMinutes);
  if (
    !Number.isInteger(parsedReminder) ||
    parsedReminder < 1 ||
    parsedReminder > 1440
  ) {
    return "Use 1-1440 minutes.";
  }

  const maxReminderMinutes = Math.floor(
    (startAt.getTime() - nowMs - REMINDER_SEND_BUFFER_MS) / 60_000,
  );

  if (maxReminderMinutes < 1) {
    return "Start time is too soon.";
  }

  if (parsedReminder > maxReminderMinutes) {
    return `Max ${maxReminderMinutes} ${
      maxReminderMinutes === 1 ? "minute" : "minutes"
    } before start.`;
  }

  return null;
};

export default function HubPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummaryResponse[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as RoomSummaryResponse[];
        setRooms(data);
      } else {
        console.error("Failed to fetch rooms:", res.status);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();

    const intervalId = window.setInterval(() => {
      void fetchRooms();
    }, 8000);

    const handleWindowFocus = () => {
      void fetchRooms();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchRooms();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchRooms]);

  // Create Room Form State
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] =
    useState<RoomActivityFilter>("all");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [scheduleVideoUrl, setScheduleVideoUrl] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleMaxCapacity, setScheduleMaxCapacity] = useState("");
  const [scheduleReminderMinutes, setScheduleReminderMinutes] = useState("30");
  const [scheduleIsPrivate, setScheduleIsPrivate] = useState(false);
  const [schedulePassword, setSchedulePassword] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const isUpcomingScheduledRoom = (room: RoomSummaryResponse) =>
    room.isScheduled &&
    room.scheduledStartAt !== null &&
    (currentTimeMs === null ||
      new Date(room.scheduledStartAt).getTime() > currentTimeMs);
  const getRoomDisplayTitle = (room: RoomSummaryResponse) =>
    room.scheduledTitle ?? room.title;

  const searchedRooms = rooms.filter(
    (room) =>
      !isUpcomingScheduledRoom(room) &&
      getRoomDisplayTitle(room)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );
  const scheduledRooms = rooms
    .filter(isUpcomingScheduledRoom)
    .sort((a, b) =>
      (a.scheduledStartAt ?? a.createdAt).localeCompare(
        b.scheduledStartAt ?? b.createdAt,
      ),
    );
  const filteredRooms = searchedRooms.filter((room) => {
    const watchingCount = getWatchingCount(room);

    if (activityFilter === "active") {
      return watchingCount > 0;
    }

    if (activityFilter === "empty") {
      return watchingCount === 0;
    }

    return true;
  });
  const activityFilters: { label: string; value: RoomActivityFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Empty", value: "empty" },
  ];
  const scheduleReminderError = getScheduleReminderError(
    scheduleDateTime,
    scheduleReminderMinutes,
    currentTimeMs,
  );

  useEffect(() => {
    setCurrentTimeMs(Date.now());

    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: {
        title: string;
        isPrivate: boolean;
        password?: string;
        maxCapacity?: number;
      } = {
        title,
        isPrivate,
      };

      if (isPrivate && password) {
        payload.password = password;
      }

      const normalizedCapacity = maxCapacity.trim();
      if (normalizedCapacity) {
        const parsedCapacity = Number(normalizedCapacity);
        if (
          !Number.isInteger(parsedCapacity) ||
          parsedCapacity < 2 ||
          parsedCapacity > 500
        ) {
          alert("Room capacity must be an integer between 2 and 500.");
          return;
        }

        payload.maxCapacity = parsedCapacity;
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
      const activateHostResponse = await fetch(
        `/api/rooms/${data.roomId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!activateHostResponse.ok) {
        console.error(
          "Failed to activate host watcher seat",
          activateHostResponse.status,
        );
        router.push(`/room/join/${data.roomId}`);
        return;
      }

      router.push(`/room/${data.roomId}`);
    } catch (error) {
      console.error("Failed to create room", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleRoom = async (event: React.FormEvent) => {
    event.preventDefault();

    const startAt = new Date(scheduleDateTime);
    if (!scheduleTitle.trim() || Number.isNaN(startAt.getTime())) {
      toast.warning("Add a title and start time");
      return;
    }

    const reminderError = getScheduleReminderError(
      scheduleDateTime,
      scheduleReminderMinutes,
      Date.now(),
    );
    if (reminderError) {
      toast.warning(reminderError);
      return;
    }

    if (scheduleIsPrivate && !schedulePassword.trim()) {
      toast.warning("Add a password for private access");
      return;
    }

    setIsScheduling(true);

    try {
      const payload: {
        title: string;
        description?: string;
        videoUrl?: string;
        scheduledStartAt: string;
        reminderMinutesBefore: number;
        visibility: "public" | "private";
        password?: string;
        scheduledTimezone?: string;
        maxCapacity?: number;
      } = {
        title: scheduleTitle.trim(),
        description: scheduleDescription.trim() || undefined,
        videoUrl: scheduleVideoUrl.trim() || undefined,
        scheduledStartAt: startAt.toISOString(),
        reminderMinutesBefore: Number(scheduleReminderMinutes) || 30,
        visibility: scheduleIsPrivate ? "private" : "public",
        scheduledTimezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
      };

      if (scheduleIsPrivate) {
        payload.password = schedulePassword.trim();
      }

      const normalizedCapacity = scheduleMaxCapacity.trim();
      if (normalizedCapacity) {
        const parsedCapacity = Number(normalizedCapacity);
        if (
          !Number.isInteger(parsedCapacity) ||
          parsedCapacity < 2 ||
          parsedCapacity > 500
        ) {
          toast.warning("Room capacity must be an integer between 2 and 500.");
          return;
        }

        payload.maxCapacity = parsedCapacity;
      }

      const response = await fetch("/api/rooms/scheduled", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        console.warn("Failed to schedule room", response.status, message);
        return;
      }

      const data = (await response.json()) as CreateScheduledRoomResponse;
      toast.success("Party scheduled", {
        description: "Share the room link with your guests.",
      });
      router.push(`/room/${data.roomId}`);
    } catch (error) {
      console.error("Failed to schedule room", error);
      toast.error("Could not schedule party");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <main className="page-surface min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.12),transparent_48%)] font-sans text-foreground dark:bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.18),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.16),transparent_50%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 p-4 pb-20 sm:p-8">
        {/* HERO CREATE SECTION */}
        <section className="glass-card relative flex flex-col items-center overflow-hidden rounded-[2rem] border-violet-300/45 bg-white/68 p-6 text-center shadow-2xl dark:border-white/10 dark:bg-card/60 sm:p-12">
          <div className="absolute top-1/2 left-1/2 -z-10 h-100 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />

          <Badge
            variant="outline"
            className="mb-6 gap-1 border-primary/35 bg-violet-50/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-black/25"
          >
            New Session
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground drop-shadow-md">
            Start a Watch Party
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl mb-10 max-w-2xl font-medium">
            Create a room instantly. Invite friends and watch your favorite
            videos in perfect sync with live chat.
          </p>

          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-4xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center rounded-3xl border border-violet-300/40 bg-white/72 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_35px_rgba(124,58,237,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-black/35 sm:p-3"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session name (e.g. Lofi Cafe)..."
              required
              className="min-h-12 flex-1 border-none bg-transparent px-4 text-base shadow-none focus-visible:ring-0 sm:text-lg"
            />

            <div className="mx-2 hidden h-8 w-px bg-violet-300/35 dark:bg-white/10 sm:block"></div>

            <div className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-violet-300/35 bg-white/78 px-3 py-2 text-left shadow-sm transition-all focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:bg-black/40 sm:w-48">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <UsersRoundIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="room-capacity"
                  className="block text-[11px] font-semibold uppercase text-muted-foreground"
                >
                  Capacity
                </label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={2}
                  max={500}
                  step={1}
                  value={maxCapacity}
                  onChange={(event) => setMaxCapacity(event.target.value)}
                  placeholder="Unlimited"
                  className="h-6 w-full rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto px-2 pb-2 sm:pb-0">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${!isPrivate ? "bg-primary/20 text-primary ring-1 ring-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.22)]" : "text-muted-foreground hover:bg-accent/70 dark:hover:bg-white/5"}`}
              >
                <GlobeIcon className="size-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-2xl transition-all text-sm font-semibold ${isPrivate ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "text-muted-foreground hover:bg-accent/70 dark:hover:bg-white/5"}`}
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
                className="mb-2 w-full min-h-12 rounded-2xl border-violet-300/35 bg-white/78 text-sm transition-all focus-visible:ring-red-500/50 dark:border-white/10 dark:bg-black/40 sm:mb-0 sm:w-40"
              />
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className={`w-full sm:w-auto min-h-[3.2rem] px-8 rounded-2xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all text-base font-bold ${isPrivate ? "hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] bg-red-600 hover:bg-red-500 text-white" : ""}`}
            >
              {isSubmitting ? "Launching..." : "Launch"}
            </Button>
          </form>
        </section>

        <section className="glass-card panel-surface rounded-3xl p-6 shadow-lg">
          <div
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsScheduleOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CalendarClockIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Schedule a Party
                </h2>
                <p className="text-sm text-muted-foreground">
                  Plan ahead and send reminders to guests who are going.
                </p>
              </div>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary ${isScheduleOpen ? "rotate-180" : ""}`}
            >
              <ChevronDownIcon className="size-5" />
            </div>
          </div>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
              isScheduleOpen
                ? "grid-rows-[1fr] opacity-100 mt-5 pt-5 border-t border-border/60 dark:border-white/10"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={handleScheduleRoom}
                className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.65fr_0.7fr] md:items-start"
              >
                <div className="space-y-1.5 md:min-h-[5.25rem]">
                  <label
                    htmlFor="schedule-title"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Party title
                  </label>
                  <Input
                    id="schedule-title"
                    value={scheduleTitle}
                    onChange={(event) => setScheduleTitle(event.target.value)}
                    placeholder="Movie night"
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 md:min-h-[5.25rem]">
                  <label
                    htmlFor="schedule-start"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Start date and time
                  </label>
                  <Input
                    id="schedule-start"
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(event) =>
                      setScheduleDateTime(event.target.value)
                    }
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 md:min-h-[5.25rem]">
                  <label
                    htmlFor="schedule-capacity"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Capacity
                  </label>
                  <Input
                    id="schedule-capacity"
                    type="number"
                    min={2}
                    max={500}
                    step={1}
                    value={scheduleMaxCapacity}
                    onChange={(event) =>
                      setScheduleMaxCapacity(event.target.value)
                    }
                    placeholder="Unlimited"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 md:min-h-[5.25rem]">
                  <label
                    htmlFor="schedule-reminder"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Reminder minutes
                  </label>
                  <Input
                    id="schedule-reminder"
                    type="number"
                    min={1}
                    max={1440}
                    aria-invalid={Boolean(scheduleReminderError)}
                    aria-describedby="schedule-reminder-error"
                    value={scheduleReminderMinutes}
                    onChange={(event) =>
                      setScheduleReminderMinutes(event.target.value)
                    }
                    className={`h-11 rounded-xl ${
                      scheduleReminderError
                        ? "border-destructive focus-visible:ring-destructive/40"
                        : ""
                    }`}
                  />
                  <p
                    id="schedule-reminder-error"
                    className="min-h-4 truncate px-1 text-xs font-medium text-destructive"
                    title={scheduleReminderError ?? undefined}
                  >
                    {scheduleReminderError ?? ""}
                  </p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label
                    htmlFor="schedule-video-url"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    YouTube URL
                  </label>
                  <Input
                    id="schedule-video-url"
                    value={scheduleVideoUrl}
                    onChange={(event) =>
                      setScheduleVideoUrl(event.target.value)
                    }
                    placeholder="Optional YouTube URL"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label
                    htmlFor="schedule-description"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Description
                  </label>
                  <Input
                    id="schedule-description"
                    value={scheduleDescription}
                    onChange={(event) =>
                      setScheduleDescription(event.target.value)
                    }
                    placeholder="Optional description"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="px-1 text-xs font-semibold text-muted-foreground">
                    Access
                  </span>
                  <div className="flex h-11 rounded-xl border border-border/70 bg-background/70 p-1 dark:border-white/10 dark:bg-black/20">
                    <button
                      type="button"
                      onClick={() => setScheduleIsPrivate(false)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                        !scheduleIsPrivate
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/10"
                      }`}
                    >
                      <GlobeIcon className="size-4" />
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleIsPrivate(true)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                        scheduleIsPrivate
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/10"
                      }`}
                    >
                      <LockIcon className="size-4" />
                      Private
                    </button>
                  </div>
                </div>
                <div
                  aria-hidden={!scheduleIsPrivate}
                  className={`space-y-1.5 transition-opacity ${
                    scheduleIsPrivate
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <label
                    htmlFor="schedule-password"
                    className="px-1 text-xs font-semibold text-muted-foreground"
                  >
                    Password
                  </label>
                  <Input
                    id="schedule-password"
                    type="password"
                    value={schedulePassword}
                    onChange={(event) =>
                      setSchedulePassword(event.target.value)
                    }
                    placeholder="Private access password"
                    required={scheduleIsPrivate}
                    disabled={!scheduleIsPrivate}
                    tabIndex={scheduleIsPrivate ? 0 : -1}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={
                    isScheduling ||
                    !scheduleTitle.trim() ||
                    Boolean(scheduleReminderError)
                  }
                  className="h-11 rounded-xl px-5 md:col-start-4 md:justify-self-end"
                >
                  {isScheduling ? "Scheduling..." : "Schedule Party"}
                </Button>
              </form>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-1 border-b border-border/60 pb-4 dark:border-white/5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight">
                Scheduled Parties
              </h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Upcoming planned sessions sorted by start time.
              </p>
            </div>
          </div>

          {isLoadingRooms ? (
            <div className="glass-card rounded-3xl border-dashed py-10 text-center text-muted-foreground">
              <CalendarClockIcon className="mx-auto mb-3 size-8 animate-pulse opacity-30" />
              <p>Loading scheduled parties...</p>
            </div>
          ) : scheduledRooms.length === 0 ? (
            <div className="glass-card rounded-3xl border-dashed py-10 text-center text-muted-foreground">
              <CalendarClockIcon className="mx-auto mb-3 size-8 opacity-30" />
              <p>No scheduled parties yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scheduledRooms.map((room) => (
                <Card
                  key={room.roomId}
                  className="glass-card flex flex-col overflow-hidden cursor-pointer rounded-3xl border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 dark:border-white/10 relative"
                  onClick={() => router.push(`/room/join/${room.roomId}`)}
                >
                  <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10" />

                  <CardContent className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div className="min-w-0">
                        <Badge
                          variant="outline"
                          className="mb-3 w-fit border-primary/30 bg-primary/10 text-primary shadow-sm text-xs font-semibold px 2.5 py-0.5 rounded-full"
                        >
                          Upcoming Party
                        </Badge>
                        <h3 className="line-clamp-2 text-xl font-extrabold leading-tight transition-colors group-hover:text-primary mb-2">
                          {room.scheduledTitle ?? room.title}
                        </h3>
                        {room.scheduledDescription && (
                          <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                            {room.scheduledDescription}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 bg-black/5 dark:bg-black/20 rounded-2xl p-4 border border-border/40 dark:border-white/5 mb-6 flex-1">
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <div className="flex shrink-0 items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                          <CalendarIcon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Date & Time
                          </span>
                          <span className="text-foreground">
                            {formatScheduledStart(room.scheduledStartAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        <div className="flex shrink-0 items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                          <UsersRoundIcon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Capacity
                          </span>
                          <span className="text-foreground">
                            {room.maxCapacity
                              ? `Max ${room.maxCapacity} people`
                              : "Unlimited capacity"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        <div className="flex shrink-0 items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                          <ClockIcon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Reminder
                          </span>
                          <span className="text-foreground">
                            {room.reminderMinutesBefore ?? 30} min before
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-5 dark:border-white/5">
                      {room.isPrivate ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-red-500 bg-red-500/10 px-2.5 py-1 rounded-lg">
                          <LockIcon className="size-3.5" /> Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                          <GlobeIcon className="size-3.5" /> Public
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
                      >
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ACTIVE ROOMS GRID */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4 dark:border-white/5">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight">
                Explore Rooms
              </h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Join an active session and watch together.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex rounded-xl border border-border/70 bg-background/70 p-1 dark:border-white/10 dark:bg-black/20">
                {activityFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActivityFilter(filter.value)}
                    className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
                      activityFilter === filter.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/10"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sessions..."
                  className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 text-sm focus-visible:ring-primary/40 dark:border-white/10 dark:bg-black/20"
                />
              </div>
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

            {!isLoadingRooms &&
              filteredRooms.map((room) => {
                const watchingCount = getWatchingCount(room);

                return (
                  <Card
                    key={room.roomId}
                    className={`glass-card border-border/60 hover:border-primary/40 transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col hover:-translate-y-1 rounded-3xl dark:border-white/10`}
                    onClick={() => router.push(`/room/join/${room.roomId}`)}
                  >
                    {/* Visual Header */}
                    <div
                      className="h-28 relative border-b border-border/50 bg-cover bg-center dark:border-white/5"
                      style={{
                        backgroundImage: extractYoutubeId(room.videoUrl)
                          ? `url(https://img.youtube.com/vi/${extractYoutubeId(room.videoUrl)}/hqdefault.jpg)`
                          : "none",
                      }}
                    >
                      {/* Backdrop overlay for readability if map has video */}
                      {extractYoutubeId(room.videoUrl) && (
                        <div className="absolute inset-0 bg-slate-950/20 transition-all group-hover:bg-slate-950/10 dark:bg-black/20 dark:group-hover:bg-black/10" />
                      )}

                      {!extractYoutubeId(room.videoUrl) && (
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/30 via-background to-background" />
                      )}

                      <div className="absolute top-4 right-4 z-10">
                        {room.isPrivate ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-red-500/30 bg-red-500/15 text-red-700 shadow-sm backdrop-blur-md dark:bg-red-950/40 dark:text-red-400"
                          >
                            <LockIcon className="size-3" /> Private
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-700 shadow-sm backdrop-blur-md dark:bg-emerald-950/40 dark:text-emerald-400"
                          >
                            <GlobeIcon className="size-3" /> Public
                          </Badge>
                        )}
                      </div>
                      <div className="absolute -bottom-5 left-5 z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-lg text-primary dark:border-white/10">
                        <MonitorPlayIcon className="size-5" />
                      </div>
                    </div>

                    <CardContent className="p-5 flex-1 flex flex-col pt-8">
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                        {getRoomDisplayTitle(room)}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2 mb-6 font-medium">
                        <UsersRoundIcon className="size-4 opacity-70" />{" "}
                        {formatWatchingLabel(room)}
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-4 dark:border-white/5">
                        <div className="flex -space-x-2">
                          {/* Decorative avatars */}
                          {[...Array(Math.min(3, watchingCount))].map(
                            (_, i) => (
                              <div
                                key={i}
                                className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-muted text-[8px] text-muted-foreground shadow-sm dark:border-black dark:bg-zinc-800 dark:text-zinc-400"
                              >
                                👤
                              </div>
                            ),
                          )}
                          {watchingCount > 3 && (
                            <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-primary/20 text-[9px] font-bold text-primary shadow-sm dark:border-black">
                              +{watchingCount - 3}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="glass-card bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(232,121,249,0.05)]"
                        >
                          Join Party
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      </div>
    </main>
  );
}
