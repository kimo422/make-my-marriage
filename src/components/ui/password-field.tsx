"use client";

import { useState, type ComponentProps } from "react";

import { Field } from "@/components/ui/field";

export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => {
            setVisible((v) => !v);
          }}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="hover:bg-stone rounded-full p-1.5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            {visible ? null : <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" />}
          </svg>
        </button>
      }
    />
  );
}
