"use client";

import { ReactNode, useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => {
        setShouldRender(true);
        // next frame so the element is in the DOM before we animate
        requestAnimationFrame(() => setAnimateIn(true));
      });

      return () => cancelAnimationFrame(raf);
    }

    // closing
    const raf = requestAnimationFrame(() => setAnimateIn(false));
    const timeout = window.setTimeout(() => setShouldRender(false), 220);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/35 backdrop-blur-sm transition-opacity duration-200 dark:bg-black/60 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl shadow-[0_0_35px_rgba(14,165,233,0.18)] transition-all duration-220 ease-out glass-card panel-surface ${
          animateIn
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-accent/40 px-5 py-4 dark:border-white/10 dark:bg-white/5">
          {title && (
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-auto h-8 w-8 rounded-xl hover:bg-accent dark:hover:bg-white/10"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
