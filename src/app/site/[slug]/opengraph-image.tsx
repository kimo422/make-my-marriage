import { CARD_SIZES, renderInviteCard } from "@/lib/invite-card";
import { getSiteCard } from "@/modules/weddings";

// The preview WhatsApp and other apps show when the website's link is shared.

export const alt = "Wedding invitation";
export const size = CARD_SIZES.landscape;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getSiteCard(slug);
  if (!card) return new Response("Not found", { status: 404 });
  return renderInviteCard(card.wedding, "landscape");
}
