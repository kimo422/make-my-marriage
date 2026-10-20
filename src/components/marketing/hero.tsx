import Link from "next/link";
import type { ReactNode } from "react";

const events = [
  { name: "Haldi", when: "5 Feb · 10:00 AM", count: 85 },
  { name: "Mehendi", when: "5 Feb · 4:30 PM", count: 110 },
  { name: "Sangeet", when: "6 Feb · 7:00 PM · Taj Krishna", count: 142, active: true },
  { name: "Muhurtham", when: "7 Feb · 9:15 AM", count: 240 },
  { name: "Reception", when: "7 Feb · 7:30 PM", count: 230 },
];

const promises = [
  { title: "Private by default", body: "Guest details stay with your family's members" },
  { title: "No app for guests", body: "One personal link, opened from WhatsApp" },
  { title: "Works on any phone", body: "Built for small screens and slow networks" },
  { title: "Made for Indian weddings", body: "Multi-day functions, both families" },
];

function Chip({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "blush" }) {
  return (
    <span
      className={
        tone === "blush"
          ? "bg-blush rounded-full px-2.5 py-0.5 text-xs font-semibold"
          : "bg-stone rounded-full px-2.5 py-0.5 text-xs font-semibold"
      }
    >
      {children}
    </span>
  );
}

/** Illustrative product preview: timeline, RSVP tracker and the guest's phone. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md pb-40 lg:mx-0 lg:ml-auto lg:pb-28">
      <div className="border-hairline rounded-b-card rounded-t-[10rem] border bg-white px-6 pt-10 pb-6 shadow-[0_16px_40px_-8px_rgba(31,27,36,0.10)]">
        <div className="text-center">
          <span className="bg-emerald-soft text-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            <span className="bg-emerald size-1.5 rounded-full" /> Wedding workspace
          </span>
          <p className="mt-3 font-serif text-2xl">Ananya &amp; Rohan</p>
          <p className="text-ink-muted text-sm">7 Feb 2027 · Hyderabad</p>
        </div>
        <ol className="border-hairline mt-5 space-y-1 border-t pt-4">
          {events.map((e) => (
            <li
              key={e.name}
              className={
                e.active
                  ? "bg-stone/70 flex items-center gap-3 rounded-xl px-3 py-2.5"
                  : "flex items-center gap-3 px-3 py-2.5"
              }
            >
              <span
                className={
                  e.active
                    ? "bg-emerald size-2.5 shrink-0 rounded-full"
                    : "border-hairline size-2.5 shrink-0 rounded-full border-2"
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{e.name}</span>
                <span className="text-ink-muted block truncate text-xs">{e.when}</span>
              </span>
              <Chip tone={e.active ? "blush" : "stone"}>{e.count} attending</Chip>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-hairline rounded-card absolute bottom-10 left-0 w-60 border bg-white p-4 shadow-[0_4px_20px_-2px_rgba(31,27,36,0.08)] sm:w-64 lg:-left-10">
        <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">RSVPs</p>
        <p className="mt-1 font-serif text-3xl">
          186 <span className="text-ink-muted font-sans text-sm">of 240 households</span>
        </p>
        <div className="bg-stone mt-3 h-1.5 overflow-hidden rounded-full">
          <div className="bg-emerald h-full w-[78%] rounded-full" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["172", "Attending"],
            ["14", "Declined"],
            ["54", "Waiting"],
          ].map(([n, label]) => (
            <div key={label} className="bg-field rounded-lg py-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className="text-sm font-semibold">{n}</dd>
              <dd className="text-ink-muted text-[0.65rem] tracking-wide uppercase">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-hairline absolute right-0 bottom-0 w-48 rounded-[2rem] border-4 bg-white p-3 shadow-[0_16px_40px_-8px_rgba(31,27,36,0.14)] sm:w-52 lg:-right-6">
        <div className="border-hairline bg-ivory rounded-t-[1.5rem] rounded-b-xl border p-3 text-center">
          <p className="font-serif text-sm leading-snug">
            Sharma family, you&apos;re invited to the Sangeet
          </p>
          <p className="text-ink-muted mt-1 text-[0.7rem]">Fri, 6 Feb · 7:00 PM · Taj Krishna</p>
          <div className="border-hairline mt-3 flex items-center justify-between rounded-full border bg-white px-3 py-1.5 text-xs">
            <span>Attending</span>
            <span className="flex items-center gap-2 font-semibold">
              <span className="border-hairline flex size-5 items-center justify-center rounded-full border">
                −
              </span>
              4
              <span className="border-hairline flex size-5 items-center justify-center rounded-full border">
                +
              </span>
            </span>
          </div>
          <div className="bg-emerald text-ivory mt-3 rounded-full py-1.5 text-xs font-medium">
            Confirm RSVP
          </div>
          <p className="text-ink-muted mt-2 text-[0.6rem]">You can change this until 20 Jan</p>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-14 overflow-x-clip px-4 pt-12 pb-16 sm:px-8 lg:grid-cols-2 lg:pt-20">
      <div>
        <span className="border-hairline text-ink-muted inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase">
          The wedding planner for Indian families
        </span>
        <h1 className="mt-6 font-serif text-[2.75rem] leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          From the first invite to the last photo.
        </h1>
        <p className="text-ink-muted mt-6 max-w-xl text-lg sm:text-xl">
          Plan every function, collect every RSVP and gather every memory, together with your
          family, in one calm place.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/sign-up"
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-14 items-center rounded-full px-8 text-lg font-medium"
          >
            Start planning, it&apos;s free
          </Link>
          <a href="#how-it-works" className="text-emerald font-medium">
            See how it works →
          </a>
        </div>
        <ul className="border-hairline mt-12 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4">
          {promises.map((p) => (
            <li key={p.title}>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-ink-muted mt-1 text-sm leading-snug">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
      <ProductPreview />
    </section>
  );
}
