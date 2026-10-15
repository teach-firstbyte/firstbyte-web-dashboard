"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Segmented } from "@/components/common/Segmented";

type Theme = "system" | "light" | "dark";

/**
 * Match my device / Light / Dark. The same setting as the theme button in the
 * top bar, so the two stay in step.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // next-themes only knows the theme after hydration; show "system" until then
  // so the server and first client render agree.
  const value = (mounted ? theme : "system") as Theme;

  return (
    <Segmented<Theme>
      label="Theme"
      value={value ?? "system"}
      onValueChange={setTheme}
      options={[
        { value: "system", label: "Match my device" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
