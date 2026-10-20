import { Hero } from "@/components/marketing/hero";
import {
  Families,
  Faq,
  Features,
  FinalCta,
  HowItWorks,
  Privacy,
  Problem,
  SiteFooter,
} from "@/components/marketing/sections";
import { SiteHeader } from "@/components/marketing/site-header";

// Homepage from the Stitch "Full Homepage Experience" design, with the copy
// rewritten to describe only what the app does.
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Families />
        <Privacy />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
