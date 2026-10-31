import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const modalStack: HTMLElement[] = [];

export function useModalAccessibility<T extends HTMLElement = HTMLDivElement>(
  onClose?: () => void,
  enabled = true,
) {
  const modalRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const container = modalRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalStack.push(container);

    // Move focus inside the modal if focus is currently outside it
    const focusTimer = window.setTimeout(() => {
      if (!container.contains(document.activeElement)) {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          container.focus();
        }
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      const topModal = modalStack[modalStack.length - 1];
      if (topModal !== container) return;

      if (e.key === "Escape") {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || !container.contains(active) || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || !container.contains(active) || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      const idx = modalStack.lastIndexOf(container);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        document.body.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [enabled]);

  return modalRef;
}
