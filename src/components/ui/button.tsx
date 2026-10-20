import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

const variants: Record<Variant, string> = {
  primary: "bg-emerald text-ivory hover:bg-emerald-hover",
  secondary: "border border-hairline bg-field text-ink hover:bg-stone",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-medium transition active:scale-[0.98] disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
