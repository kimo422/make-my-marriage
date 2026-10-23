import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { ArchCard } from "@/components/ui/card";
import { SiteUnlock } from "@/components/website/site-unlock";
import { daysUntil, formatEventDay, formatLongDate, formatTime } from "@/lib/dates";
import { getPublicSite, getSiteCard } from "@/modules/weddings";

// The public wedding website (FR-8.1–8.4): built from the wedding and its
// public events. Unpublished or unknown addresses are a plain 404.

export async function generateMetadata({ params }: PageProps<"/site/[slug]">): Promise<Metadata> {
  // The site changes when the couple edits it, so it's rendered per request.
  await connection();
  const { slug } = await params;
  const card = await getSiteCard(slug);
  if (!card) return { title: "Not found", robots: { index: false, follow: false } };
  const { wedding } = card;
  const title = `${wedding.brideName} & ${wedding.groomName}`;
  const description = `${formatLongDate(wedding.primaryDate)} · ${wedding.city}`;
  return {
    title: { absolute: title },
    description,
    robots: card.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: "website" },
  };
}

export default function WeddingSitePage({ params }: PageProps<"/site/[slug]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10">
      <Suspense fallback={<FormFallback fields={3} />}>
        <WeddingSite params={params} />
      </Suspense>
      <footer className="text-ink-muted mt-auto pt-16 text-center text-xs">
        Made with{" "}
        <Link href="/" className="font-serif text-sm underline-offset-2 hover:underline">
          Make My Marriage
        </Link>
      </footer>
    </main>
  );
}

function countdown(days: number): string | null {
  if (days > 1) return `${String(days)} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return null;
}

async function WeddingSite({ params }: { params: Promise<{ slug: string }> }) {
  // Reads today's date (countdown) and the unlock cookie's expiry: per request.
  await connection();
  const { slug } = await params;
  const jar = await cookies();
  const site = await getPublicSite(slug, (name) => jar.get(name)?.value);
  if (!site) notFound();

  if (site.locked) {
    return (
      <ArchCard className="mx-auto w-full max-w-[26rem] space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">
            Wedding website
          </p>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
            {site.brideName} &amp; {site.groomName}
          </h1>
          <p className="text-ink-muted">
            This page is private. Enter the password from the family.
          </p>
        </div>
        <div className="text-left">
          <SiteUnlock slug={slug} />
        </div>
      </ArchCard>
    );
  }

  const left = countdown(daysUntil(site.primaryDate, site.timezone));
  return (
    <div className="space-y-10">
      <ArchCard className="space-y-3 py-12 text-center sm:py-16">
        <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">
          We&apos;re getting married
        </p>
        <h1 className="font-serif text-[2.75rem] leading-[1.05] tracking-tight sm:text-6xl">
          {site.brideName}
          <span className="text-emerald block py-1 text-3xl sm:text-4xl">&amp;</span>
          {site.groomName}
        </h1>
        <div className="bg-blush mx-auto my-5 h-px w-16" aria-hidden="true" />
        <p className="text-lg">{formatLongDate(site.primaryDate)}</p>
        <p className="text-ink-muted">
          {site.city}
          {site.tradition ? ` · ${site.tradition} wedding` : ""}
        </p>
        {left ? <p className="text-emerald pt-2 text-sm font-semibold">{left}</p> : null}
      </ArchCard>

      {site.story ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Our story</h2>
          <p className="leading-relaxed whitespace-pre-line">{site.story}</p>
        </section>
      ) : null}

      {site.events.length ? (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl">Celebrations</h2>
          <ol className="space-y-3">
            {site.events.map((e) => (
              <li key={e.id} className="border-hairline rounded-card border bg-white p-5">
                <p className="font-serif text-xl">{e.name}</p>
                <p className="text-ink-muted mt-1 text-sm">
                  {formatEventDay(e.startAt, site.timezone)} ·{" "}
                  {formatTime(e.startAt, site.timezone)} – {formatTime(e.endAt, site.timezone)}
                </p>
                {e.venue.name || e.venue.address ? (
                  <p className="mt-2">
                    {[e.venue.name, e.venue.address].filter(Boolean).join(", ")}
                    {e.venue.mapUrl ? (
                      <>
                        {" · "}
                        <a
                          href={e.venue.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald font-medium underline underline-offset-2"
                        >
                          Map
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {e.dressCode ? (
                  <p className="text-ink-muted mt-1 text-sm">Dress code: {e.dressCode}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="bg-emerald-soft rounded-card space-y-2 p-6 text-center">
        <h2 className="font-serif text-2xl">RSVP</h2>
        <p>
          Your invitation on WhatsApp has a personal link for your family. Open it to tell us
          who&apos;s coming to each celebration.
        </p>
      </section>
    </div>
  );
}
