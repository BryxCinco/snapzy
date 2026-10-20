import type { Metadata, Viewport } from "next";
import { Caveat, Poppins } from "next/font/google";
import { ThemeSync } from "@/components/preferences";
import { themeBootScript } from "@/lib/theme-boot";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Handwritten accent for captions and greetings — the "human touch".
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Snapzy",
  description: "AI-Powered Screenshot Sorter & Picture Organizer",
};

export const viewport: Viewport = {
  themeColor: "#f6f8fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${caveat.variable} h-full antialiased`}
      // The boot script sets data-theme / lang before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      {/* overflow-x-clip: a stray wide element can't widen the page on phones
          (which would push fixed bars off screen). Unlike overflow-hidden it
          doesn't break position: sticky. */}
      <body className="flex min-h-full flex-col overflow-x-clip bg-paper font-sans text-ink">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
