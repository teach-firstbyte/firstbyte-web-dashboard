"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandMenu = dynamic(
  () => import("@/components/command-menu").then((mod) => mod.CommandMenu),
  { ssr: false },
);

// Loads the ⌘K menu (cmdk, Radix Dialog and the team list) the first time
// someone presses ⌘K or clicks Search, instead of on every page load. After
// that the menu's own keyboard listener takes over.
export function CommandMenuLoader() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [loaded]);

  return loaded ? <CommandMenu defaultOpen /> : null;
}
