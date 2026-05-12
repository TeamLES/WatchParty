"use client";

import { useState } from "react";
import { BookmarkPlusIcon, PlayIcon, Edit3Icon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HighlightResponse } from "@watchparty/shared-types";

interface HighlightsSectionProps {
  highlights: HighlightResponse[];
  isLoading: boolean;
  currentUserId: string | null;
  isHostUser: boolean;
  roomMembers: Array<{
    userId: string;
    nickname?: string | null;
    role?: string;
  }>;
  onPlayHighlight: (highlight: HighlightResponse) => void;
  onEditHighlight: (highlight: HighlightResponse) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onRecordHighlight: () => void;
  deletingHighlightId: string | null;
  formatMemberDisplayName: (member: {
    userId: string;
    nickname?: string | null;
    role?: string;
  }) => string;
}

function formatDurationMs(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function HighlightsSection({
  highlights,
  isLoading,
  currentUserId,
  isHostUser,
  roomMembers,
  onPlayHighlight,
  onEditHighlight,
  onDeleteHighlight,
  onRecordHighlight,
  deletingHighlightId,
  formatMemberDisplayName,
}: HighlightsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="glass-card panel-surface flex max-h-[34rem] flex-col overflow-hidden rounded-2xl shadow-lg lg:max-h-[18rem]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-primary/5 p-4 dark:border-white/10 dark:from-primary/20 dark:to-primary/10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-inner">
            <BookmarkPlusIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">
              Highlights
            </h2>
            <p className="text-xs text-muted-foreground">
              {highlights.length} saved
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onRecordHighlight}
          className="shrink-0 rounded-xl bg-primary px-3 font-semibold text-primary-foreground shadow-[0_0_15px_rgba(232,121,249,0.18)] transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,121,249,0.28)]"
        >
          <BookmarkPlusIcon className="mr-2 size-4" />
          Record
        </Button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border dark:scrollbar-thumb-white/10">
        {isLoading ? (
          <div className="flex h-36 items-center justify-center text-muted-foreground">
            <p className="text-sm">Loading highlights...</p>
          </div>
        ) : highlights.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary/60">
              <BookmarkPlusIcon className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No highlights yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Record a clip while watching and it will show up here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {highlights.map((highlight) => {
              const creator = roomMembers.find(
                (member) => member.userId === highlight.createdByUserId,
              );
              const creatorLabel = creator
                ? formatMemberDisplayName(creator)
                : `User ${highlight.createdByUserId.slice(0, 8)}`;
              const canDeleteHighlight =
                currentUserId === highlight.createdByUserId || isHostUser;
              const canEditHighlight = currentUserId === highlight.createdByUserId;
              const isExpanded = expandedId === highlight.highlightId;
              const durationLabel = formatDurationMs(
                highlight.endMs - highlight.startMs,
              );

              return (
                <div
                  key={highlight.highlightId}
                  className="group overflow-hidden rounded-xl border border-border/50 bg-card/70 transition-all hover:bg-card/90 dark:border-white/10 dark:hover:bg-white/15"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : highlight.highlightId)
                    }
                    className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent/25 dark:hover:bg-white/5"
                  >
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                        {durationLabel}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {highlight.title ?? "Untitled highlight"}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                            {formatDurationMs(highlight.startMs)} → {formatDurationMs(highlight.endMs)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-lg text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/15"
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlayHighlight(highlight);
                          }}
                          title="Play highlight"
                        >
                          <PlayIcon className="size-4 fill-current" />
                        </Button>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        by <span className="font-medium text-primary/80">{creatorLabel}</span>
                      </p>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border/30 bg-accent/20 p-3 dark:border-white/5 dark:bg-white/5">
                      {highlight.note ? (
                        <div className="mb-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Note
                          </p>
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {highlight.note}
                          </p>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlayHighlight(highlight);
                          }}
                          className="rounded-lg bg-primary/15 text-xs font-medium text-primary hover:bg-primary/25"
                        >
                          <PlayIcon className="mr-1.5 size-3.5 fill-current" />
                          Play
                        </Button>

                        {canEditHighlight ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditHighlight(highlight);
                            }}
                            className="rounded-lg text-xs font-medium hover:bg-accent dark:hover:bg-white/10"
                          >
                            <Edit3Icon className="mr-1.5 size-3.5" />
                            Edit
                          </Button>
                        ) : null}

                        {canDeleteHighlight ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteHighlight(highlight.highlightId);
                            }}
                            disabled={deletingHighlightId === highlight.highlightId}
                            className="rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <TrashIcon className="mr-1.5 size-3.5" />
                            {deletingHighlightId === highlight.highlightId
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
