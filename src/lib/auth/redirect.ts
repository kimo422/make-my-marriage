/**
 * Turns a `?next=` value into a safe same-site path. Anything that could leave
 * the app (absolute URLs, `//host`, backslash tricks) falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
