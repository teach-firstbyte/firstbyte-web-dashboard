import type React from "react";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandMenu } from "@/components/command-menu";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "FirstByte - CS & STEM Education",
  description: "Empowering the next generation through CS & STEM education",
  icons: {
    icon: {
      url: "/FirstByteBitex4.png",
      type: "image/png",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CommandMenu />
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
