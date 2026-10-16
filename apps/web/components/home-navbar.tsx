"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";

// Homepage sections in page order, by element id
const SECTION_IDS = ["home", "about", "programs", "team"];

// The homepage navbar, highlighting the section you have scrolled to. It finds
// the sections by id, so the page itself can stay a server component.
export function HomeNavbar() {
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (
          section &&
          scrollPosition < section.offsetTop + section.offsetHeight
        ) {
          setActiveSection(id);
          return;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <Navbar activeSection={activeSection} />;
}
