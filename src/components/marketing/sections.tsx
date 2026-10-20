import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{title}</h2>
      {intro ? <p className="text-ink-muted mt-4 text-lg">{intro}</p> : null}
    </div>
  );
}

function Band({ id, tone, children }: { id?: string; tone?: "stone"; children: ReactNode }) {
  return (
    <section
      id={id}
      className={
        tone === "stone" ? "bg-stone scroll-mt-16 py-20 sm:py-24" : "scroll-mt-16 py-20 sm:py-24"
      }
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8">{children}</div>
    </section>
  );
}

export function Problem() {
  return (
    <Band tone="stone">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
          Weddings run on WhatsApp groups and spreadsheets. Details get buried, headcounts drift,
          and families lose track of who told whom what.
        </h2>
        <p className="text-ink-muted mt-6 text-lg">
          Make My Marriage gives both families one shared place: a clear timeline of every function,
          confirmed RSVPs per household, and tasks everyone can see.
        </p>
      </div>
    </Band>
  );
}

const features = [
  {
    title: "Events & timeline",
    body: "Haldi to reception, each with its date, time, venue, map link and dress code.",
  },
  {
    title: "Guests by household",
    body: "Group guests into families, tag bride's or groom's side, or import a CSV.",
  },
  {
    title: "RSVP per household",
    body: "One link per family. They pick who's coming to each function and can change it until your deadline.",
  },
  {
    title: "WhatsApp invites",
    body: "A ready-written message with each family's personal link. Tap, and it opens in WhatsApp to send.",
  },
  {
    title: "Task board",
    body: "Shared to-dos linked to events, with owners, due dates and a starter checklist per function.",
  },
  {
    title: "Photo gallery",
    body: "Guests scan a QR code and upload photos, no sign-up. You remove anything that shouldn't be there.",
  },
];

export function Features() {
  return (
    <Band id="features">
      <SectionHeading
        eyebrow="Features"
        title="Designed for every function, built for every generation."
        intro="Six tools shaped around how Indian families actually plan a multi-day wedding."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <li
            key={f.title}
            className="border-hairline rounded-card border bg-white p-6 first:rounded-t-[2.5rem] sm:p-7"
          >
            <span className="text-ink-muted font-serif text-sm">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 font-serif text-2xl">{f.title}</h3>
            <p className="text-ink-muted mt-2">{f.body}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}

const steps = [
  { title: "Create your wedding", body: "Add the couple's names, the main date and your city." },
  {
    title: "Add functions & families",
    body: "List each event, add households from both sides and choose who's invited to what.",
  },
  {
    title: "Send invites",
    body: "Send each family their link on WhatsApp from your own phone, then watch RSVPs arrive.",
  },
  {
    title: "Collect memories",
    body: "Put the gallery QR code on the tables. Everyone's photos land in one private album.",
  },
];

export function HowItWorks() {
  return (
    <Band id="how-it-works" tone="stone">
      <SectionHeading
        eyebrow="How it works"
        title="From first invite to final album in four steps."
      />
      <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="border-hairline rounded-card bg-ivory border p-6">
            <span className="bg-emerald text-ivory flex size-9 items-center justify-center rounded-full text-sm font-semibold">
              {i + 1}
            </span>
            <h3 className="mt-4 font-serif text-xl">{s.title}</h3>
            <p className="text-ink-muted mt-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </Band>
  );
}

const roles = [
  {
    who: "The couple",
    role: "Owners",
    body: "Run the whole wedding: details, events, website, gallery and who's on the team.",
  },
  {
    who: "Parents",
    role: "Wedding managers",
    body: "Plan alongside the couple, manage guests and tasks, and invite relatives to help.",
  },
  {
    who: "Siblings & cousins",
    role: "Organizers",
    body: "Handle their side's guests and invites, and pick up tasks from the board.",
  },
  {
    who: "Anyone else",
    role: "Viewers",
    body: "Follow along with the timeline and RSVP counts, without seeing contact details.",
  },
];

export function Families() {
  return (
    <Band id="families">
      <SectionHeading
        eyebrow="For families"
        title="Bride's side and groom's side, planning together."
        intro="Everyone gets the access their role needs. Organizers only see guests from their own side."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r) => (
          <li key={r.who} className="border-hairline rounded-card border bg-white p-6">
            <span className="bg-blush rounded-full px-3 py-1 text-xs font-semibold">{r.role}</span>
            <h3 className="mt-4 font-serif text-2xl">{r.who}</h3>
            <p className="text-ink-muted mt-2">{r.body}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}

const privacy = [
  {
    title: "Hidden from search engines",
    body: "Your wedding pages and photos aren't indexed unless you choose to allow it.",
  },
  {
    title: "Location data removed",
    body: "GPS and camera details are stripped from every photo before anyone sees it.",
  },
  {
    title: "Links you control",
    body: "Regenerate a family's RSVP link or the gallery QR code and the old one stops working.",
  },
  {
    title: "Deleted after the wedding",
    body: "Download your photos any time. Everything is deleted six months after the wedding date.",
  },
];

export function Privacy() {
  return (
    <Band id="privacy" tone="stone">
      <SectionHeading
        eyebrow="Privacy"
        title="Private by default. Protected for your family."
        intro="No public profiles, no ads, no social feed. Guest phone numbers and emails are only visible to your planning team."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {privacy.map((p) => (
          <li key={p.title} className="border-hairline rounded-card bg-ivory border p-6">
            <h3 className="font-serif text-xl">{p.title}</h3>
            <p className="text-ink-muted mt-2">{p.body}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}

const faqs = [
  {
    q: "Is it free?",
    a: "Yes. Make My Marriage is free to use.",
  },
  {
    q: "Do guests need accounts?",
    a: "No. Each family gets a personal link. They open it from WhatsApp, answer for each function and they're done. No app, no password.",
  },
  {
    q: "Can parents use it?",
    a: "Yes. Text is large, buttons are easy to tap, and every screen works on a phone.",
  },
  {
    q: "Who can see our photos?",
    a: "People with your gallery link or QR code. You can add a PIN, keep some albums for your planning team only, or regenerate the link at any time.",
  },
  {
    q: "Can both families plan together?",
    a: "Yes. Invite parents, siblings and cousins with the role that suits them. Organizers only manage guests on their own side.",
  },
  {
    q: "What happens after the wedding?",
    a: "Close uploads and download every photo as a ZIP. Six months after the wedding date, all its data and photos are deleted.",
  },
];

export function Faq() {
  return (
    <Band>
      <SectionHeading eyebrow="Questions" title="Frequently asked questions." />
      <div className="divide-hairline border-hairline rounded-card mx-auto mt-12 max-w-3xl divide-y border bg-white">
        {faqs.map((f) => (
          <details key={f.q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl">
              {f.q}
              <span className="text-ink-muted transition group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="text-ink-muted mt-3">{f.a}</p>
          </details>
        ))}
      </div>
    </Band>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-8">
      <div className="bg-emerald text-ivory rounded-b-card mx-auto max-w-7xl rounded-t-[3rem] px-6 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
          From the first invite to the last photo.
        </h2>
        <p className="text-ivory/80 mx-auto mt-4 max-w-xl text-lg">
          Bring calm and clarity to your family&apos;s wedding planning.
        </p>
        <Link
          href="/sign-up"
          className="bg-ivory text-emerald hover:bg-stone mt-8 inline-flex h-14 items-center rounded-full px-8 text-lg font-medium"
        >
          Start planning, it&apos;s free
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-hairline border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-8">
        <div>
          <Logo />
          <p className="text-ink-muted mt-3 text-sm">
            Calm, shared wedding planning for Indian families.
          </p>
        </div>
        <nav aria-label="Product" className="text-sm">
          <p className="font-semibold tracking-wide uppercase">Product</p>
          <ul className="text-ink-muted mt-3 space-y-2">
            <li>
              <a href="#how-it-works" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#features" className="hover:text-ink">
                Features
              </a>
            </li>
            <li>
              <a href="#families" className="hover:text-ink">
                For families
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal" className="text-sm">
          <p className="font-semibold tracking-wide uppercase">Legal</p>
          <ul className="text-ink-muted mt-3 space-y-2">
            <li>
              <a href="#privacy" className="hover:text-ink">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ink">
                Terms
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-hairline text-ink-muted mx-auto max-w-7xl border-t px-4 py-6 text-sm sm:px-8">
        © Make My Marriage
      </p>
    </footer>
  );
}
