"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface InfoTipProps {
  text: string;
  label?: string;
}

/**
 * Small info-icon trigger with a portal tooltip bubble. Portaling to
 * document.body is required: table cards use overflow-hidden/overflow-x-auto
 * wrappers that would clip an in-flow absolute bubble.
 */
export function InfoTip({ text, label }: InfoTipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Click (tap) pins the bubble open until an outside interaction closes it,
  // so touch users aren't at the mercy of hover state.
  const pinnedRef = useRef(false);

  const close = () => {
    pinnedRef.current = false;
    setOpen(false);
  };

  // Layout effect so the bubble is placed before paint (no 0,0 flash).
  useLayoutEffect(() => {
    if (!open) return;

    const position = () => {
      const trigger = triggerRef.current;
      const bubble = bubbleRef.current;
      if (!trigger || !bubble) return;
      const rect = trigger.getBoundingClientRect();
      const { width, height } = bubble.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.min(Math.max(left, 8), window.innerWidth - width - 8);
      let top = rect.top - height - 8;
      if (top < 8) top = rect.bottom + 8;
      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    };
    position();

    const onPointerDown = (e: PointerEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (bubbleRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScroll, { capture: true });
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", position);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mi-tip-trigger"
        aria-label={label ?? text}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinnedRef.current) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinnedRef.current) setOpen(false);
        }}
        onClick={() => {
          if (open && pinnedRef.current) {
            close();
          } else {
            pinnedRef.current = true;
            setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8v.01" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div ref={bubbleRef} id={id} role="tooltip" className="mi-tip-bubble">
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
