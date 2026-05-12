"use client";

import { useState, useEffect } from "react";
import { BookmarkPlusIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HighlightRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: { backSeconds: number; title?: string }) => Promise<void>;
  isLoading?: boolean;
  isSaved?: boolean;
  previewEndMs: number;
}

const HIGHLIGHT_BACK_SECONDS_OPTIONS = [10, 30, 60, 90, 120];

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

const HighlightRecorderModal = ({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  isSaved = false,
  previewEndMs,
}: HighlightRecorderModalProps) => {
  const [selectedSeconds, setSelectedSeconds] = useState(30);
  const [customTitle, setCustomTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(false);

  const currentPreviewStartMs = Math.max(
    0,
    previewEndMs - selectedSeconds * 1000,
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setAnimateIn(true));
      return;
    }

    setAnimateIn(false);
    const timeout = window.setTimeout(() => setShouldRender(false), 220);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCustomTitle("");
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      await onSave({
        backSeconds: selectedSeconds,
        title: customTitle || undefined,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const disabled = isProcessing || isLoading;

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-slate-900/35 backdrop-blur-sm transition-opacity duration-200 dark:bg-black/60 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl shadow-[0_0_35px_rgba(14,165,233,0.18)] transition-all duration-220 ease-out glass-card panel-surface ${
          animateIn
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-accent/40 px-5 py-4 dark:border-white/10 dark:bg-white/5">
          {isSaved ? (
            <h2 className="text-lg font-bold text-foreground">
              Highlight Saved!
            </h2>
          ) : (
            <h2 className="text-lg font-bold text-foreground">
              Create Highlight
            </h2>
          )}
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {isSaved ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary shadow-[0_0_20px_rgba(232,121,249,0.3)]">
                  <Check className="size-8" />
                </div>
                <div>
                  <p className="mb-1 font-semibold text-foreground">
                    Highlight saved successfully!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can view it in the Highlights section.
                  </p>
                </div>
                <Button
                  onClick={onClose}
                  className="mt-4 w-full rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.2)]"
                >
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 rounded-2xl border border-border/50 bg-card/50 p-4 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BookmarkPlusIcon className="size-4 text-primary" />
                    Preview duration
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatDurationMs(currentPreviewStartMs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatDurationMs(previewEndMs)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />
                  <div className="flex items-center justify-between border-t border-border/30 pt-2 text-sm dark:border-white/5">
                    <span className="text-muted-foreground">Length</span>
                    <span className="font-mono font-semibold">
                      {formatDurationMs(previewEndMs - currentPreviewStartMs)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Highlight title
                  </label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    maxLength={120}
                    placeholder={`Highlight at ${formatDurationMs(previewEndMs)}`}
                    className="h-11 rounded-xl border-border/70 bg-background/75 focus-visible:ring-primary/50 dark:border-white/10 dark:bg-black/30"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground/70">
                    {customTitle.length}/120
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Capture previous seconds
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {HIGHLIGHT_BACK_SECONDS_OPTIONS.map((seconds) => (
                      <Button
                        key={seconds}
                        type="button"
                        variant={
                          selectedSeconds === seconds ? "default" : "outline"
                        }
                        className="rounded-lg text-sm font-medium transition-all"
                        onClick={() => setSelectedSeconds(seconds)}
                        disabled={disabled}
                      >
                        {seconds}s
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    {selectedSeconds}s will be captured from before the
                    recorded moment.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={disabled}
                    className="flex-1 rounded-xl hover:bg-accent dark:hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={disabled}
                    className="flex-1 rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.2)] hover:shadow-[0_0_20px_rgba(232,121,249,0.3)] transition-all"
                  >
                    {disabled ? "Saving..." : "Save Highlight"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { HighlightRecorderModal };
export default HighlightRecorderModal;
