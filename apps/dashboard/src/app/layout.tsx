import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// The system font stack, like the marketing site, so the two zones read as one
// product. The fonts are declared in globals.css (--font-sans / --font-mono).

export const metadata: Metadata = {
  title: "FirstByte Dashboard",
  description: "Meetings, check-in and attendance for FirstByte members.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
