"use client";
import type { FilterId } from "./EventBrowser";

export const SHOW_EVENTS = "attendsure:show-events";

/**
 * In-page link to the #events section that works on every click. A plain `#events`
 * link stops scrolling once the URL already ends in that hash, so this scrolls
 * explicitly, moves focus to the heading for keyboard/screen-reader users, and
 * can switch the event filter. Without JS it falls back to a normal anchor.
 */
export default function JumpToEvents({
  filter,
  className,
  children,
}: {
  filter?: FilterId;
  className?: string;
  children: React.ReactNode;
}) {
  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const target = document.getElementById("events");
    if (!target) return;
    e.preventDefault();
    if (filter) window.dispatchEvent(new CustomEvent<FilterId>(SHOW_EVENTS, { detail: filter }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
    if (window.location.hash !== "#events") {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#events`);
    }
  }

  return (
    <a href={filter ? `/?filter=${filter}#events` : "#events"} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
