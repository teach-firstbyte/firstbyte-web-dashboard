import { HomeNavbar } from "@/components/home-navbar";
import { TeamSection } from "@/components/team-section";
import { HeroSection } from "@/components/hero-section";
import { AboutSection } from "@/components/about-section";
import { ProgramsSection } from "@/components/programs-section";
import { Footer } from "@/components/footer";

// A server component: the sections are client components where they need to
// be, and the scroll tracking for the navbar lives in HomeNavbar.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <HomeNavbar />

      <HeroSection />

      <AboutSection />

      <ProgramsSection />

      <TeamSection />

      {/* <ContactSection /> */}

      <Footer />
    </main>
  );
}
