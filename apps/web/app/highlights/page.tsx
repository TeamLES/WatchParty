"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  CalendarIcon,
  Edit3Icon,
  ExternalLinkIcon,
  TrashIcon,
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

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await fetch("/api/me/highlights", { cache: "no-store" });

      if (!res.ok) {
        throw new Error("Failed to fetch highlights");
      }

      const data = (await res.json()) as GetMyHighlightsResponse;
      setHighlights(data.highlights);
    } catch (error) {
      console.error(error);
      alert("Unable to load your highlights right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHighlights();
  }, [fetchHighlights]);

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
        throw new Error("Failed to update highlight");
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
        throw new Error("Failed to delete highlight");
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
        <section className="glass-card panel-surface flex flex-col gap-4 rounded-3xl p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_20px_rgba(168,85,247,0.18)]">
                <BookmarkIcon className="size-5" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                My Highlights
              </h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
                Manage the best moments you saved.
              </p>
            </div>
            <Button
              asChild
              variant="secondary"
              className="h-10 rounded-xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Link href="/hub">Back to Hub</Link>
            </Button>
          </div>
        </section>

        {isLoading ? (
          <div className="glass-card panel-surface rounded-3xl p-10 text-center text-muted-foreground">
            Loading highlights...
          </div>
        ) : highlights.length === 0 ? (
          <div className="glass-card panel-surface rounded-3xl p-10 text-center text-muted-foreground">
            No highlights saved yet.
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {highlights.map((highlight) => (
              <article
                key={highlight.highlightId}
                className="glass-card panel-surface overflow-hidden rounded-3xl border-border/60 shadow-lg dark:border-white/10"
              >
                <div
                  className="relative h-40 border-b border-border/50 bg-cover bg-center dark:border-white/10"
                  style={{
                    backgroundImage: `url(https://img.youtube.com/vi/${highlight.videoId}/mqdefault.jpg)`,
                  }}
                >
                  <div className="absolute inset-0 bg-slate-950/20" />
                  <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2 py-1 font-mono text-xs text-white backdrop-blur">
                    {formatDurationMs(highlight.startMs)} -{" "}
                    {formatDurationMs(highlight.endMs)}
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                      {highlight.title ?? "Untitled highlight"}
                    </h2>
                    {highlight.note ? (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {highlight.note}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 text-xs font-medium text-muted-foreground">
                    <Link
                      href={`/room/${highlight.roomId}`}
                      className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                    >
                      <ExternalLinkIcon className="size-3.5 shrink-0" />
                      <span className="truncate">Room {highlight.roomId}</span>
                    </Link>
                    <p className="flex items-center gap-1">
                      <CalendarIcon className="size-3.5" />
                      {formatCreatedAt(highlight.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4 dark:border-white/10">
                    <Button
                      asChild
                      size="sm"
                      className="h-9 rounded-xl"
                    >
                      <Link href={`/room/${highlight.roomId}`}>Open room</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => openEditModal(highlight)}
                    >
                      <Edit3Icon className="size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => void handleDeleteHighlight(highlight)}
                      disabled={deletingHighlightId === highlight.highlightId}
                    >
                      <TrashIcon className="size-4" />
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
                className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
                onClick={closeEditModal}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </main>
  );
}
