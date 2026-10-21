import { cn } from "@/lib/cn";

/** Typographic initials in a blush circle; the design system uses no photo placeholders. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-blush text-ink flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
    >
      {initials}
    </span>
  );
}
