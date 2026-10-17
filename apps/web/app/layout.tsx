import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import "./workspace.css";
import "./voice-command.css";
import "./landing.css";
import { LocaleProvider } from "@/components/locale";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-editorial" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://cognitive-mirror-two.vercel.app"),
  title: { default: "WIMAX — Think out loud. Leave with clarity.", template: "%s · WIMAX" },
  description: "Turn voice notes, meetings and reflections into tasks, habits and connected knowledge — without touching a keyboard.",
  openGraph: {
    title: "WIMAX — Think out loud. Leave with clarity.",
    description: "A voice-first operating system for your tasks, habits, meetings and knowledge.",
    images: [{ url: "/media/cognitive-mirror-voice-hero.png", width: 1536, height: 1024 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable}`}><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
