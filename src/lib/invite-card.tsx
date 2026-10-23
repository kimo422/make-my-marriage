import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { parseDateOnly } from "@/lib/dates";

// The invite card (FR-7.5): one image per wedding that families share on
// WhatsApp next to the message, and the website's link preview. Drawn with
// next/og in the app's emerald and ivory, with the Newsreader serif.

const COLORS = {
  ivory: "#FBF8F3",
  white: "#FFFFFF",
  ink: "#1F1B24",
  muted: "#5B5560",
  emerald: "#0F4C45",
  hairline: "#E3DCCF",
  blush: "#EBD5CF",
};

export interface InviteCardWedding {
  brideName: string;
  groomName: string;
  /** "YYYY-MM-DD" */
  primaryDate: string;
  city: string;
}

/** Portrait for WhatsApp (4:5), landscape for link previews (1.91:1). */
export const CARD_SIZES = {
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1200, height: 630 },
} as const;
export type CardFormat = keyof typeof CARD_SIZES;

let fonts: Promise<{ regular: Buffer; medium: Buffer }> | null = null;

function loadFonts() {
  const dir = join(process.cwd(), "src", "assets", "fonts");
  fonts ??= Promise.all([
    readFile(join(dir, "Newsreader-400.ttf")),
    readFile(join(dir, "Newsreader-500.ttf")),
  ]).then(([regular, medium]) => ({ regular, medium }));
  return fonts;
}

/** "Saturday, 12 December 2026" */
function longDate(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnly(dateOnly));
}

export async function renderInviteCard(
  wedding: InviteCardWedding,
  format: CardFormat,
  headers?: Record<string, string>,
): Promise<ImageResponse> {
  const { regular, medium } = await loadFonts();
  const size = CARD_SIZES[format];
  const portrait = format === "portrait";
  const scale = portrait ? 1 : 0.62;
  const px = (n: number) => Math.round(n * scale);
  const archWidth = portrait ? 860 : 1080;
  const longestName = Math.max(wedding.brideName.length, wedding.groomName.length);
  const nameSize = px(longestName > 14 ? 96 : 120);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: COLORS.ivory,
        fontFamily: "Newsreader",
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          width: archWidth,
          height: portrait ? 1210 : 570,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.white,
          border: `2px solid ${COLORS.hairline}`,
          borderBottomWidth: 0,
          borderTopLeftRadius: portrait ? archWidth / 2 : 300,
          borderTopRightRadius: portrait ? archWidth / 2 : 300,
          padding: portrait ? "120px 80px 80px" : "40px 80px 30px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: px(26),
            letterSpacing: px(7),
            color: COLORS.emerald,
            fontWeight: 500,
          }}
        >
          TOGETHER WITH THEIR FAMILIES
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: px(56),
            fontSize: nameSize,
            lineHeight: 1.05,
            fontWeight: 500,
          }}
        >
          <span>{wedding.brideName}</span>
          <span
            style={{ fontSize: px(64), color: COLORS.emerald, margin: `${String(px(12))}px 0` }}
          >
            &amp;
          </span>
          <span>{wedding.groomName}</span>
        </div>
        <div
          style={{
            display: "flex",
            width: px(120),
            height: 2,
            background: COLORS.blush,
            marginTop: px(56),
          }}
        />
        <div style={{ display: "flex", marginTop: px(48), fontSize: px(44) }}>
          {longDate(wedding.primaryDate)}
        </div>
        <div style={{ display: "flex", marginTop: px(12), fontSize: px(38), color: COLORS.muted }}>
          {wedding.city}
        </div>
        {portrait ? (
          <div
            style={{
              display: "flex",
              marginTop: 120,
              fontSize: 28,
              color: COLORS.emerald,
            }}
          >
            Please reply using your family&apos;s RSVP link
          </div>
        ) : null}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: regular, weight: 400, style: "normal" },
        { name: "Newsreader", data: medium, weight: 500, style: "normal" },
      ],
      ...(headers ? { headers } : {}),
    },
  );
}
