import * as React from "react";

// Smart form navigation: Enter advances focus to next focusable input,
// Shift+Enter goes back. Works inside any container that uses this handler.
export function handleSmartFormKey(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (target.tagName === "TEXTAREA") return;
  if (target.tagName === "BUTTON") return;

  const container = e.currentTarget as HTMLElement;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null);

  const idx = focusables.indexOf(target);
  if (idx === -1) return;

  e.preventDefault();
  const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
  const next = focusables[nextIdx];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement && (next.type === "number" || next.type === "text")) {
      next.select();
    }
  }
}
