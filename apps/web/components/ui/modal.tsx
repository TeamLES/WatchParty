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
  const [render, setRender] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      // Malý delay pre CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateIn(true);
        });
      });
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-sm glass-card border border-white/10 shadow-[0_0_40px_rgba(168,85,247,0.15)] rounded-3xl overflow-hidden transition-all duration-300 ease-out bg-black/40 ${
          animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
          {title && <h2 className="text-lg font-bold text-foreground">{title}</h2>}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-white/10 ml-auto">
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
