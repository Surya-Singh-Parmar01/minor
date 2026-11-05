import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NeuroScreen",
  description: "Explainable, multimodal early screening for Alzheimer's and Parkinson's disease.",
};

const nav = [
  { href: "/screen", label: "Screen" },
  { href: "/results", label: "Results" },
  { href: "/assistant", label: "Assistant" },
  { href: "/care-plan", label: "Care plan" },
  { href: "/clinician", label: "Clinician" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
            <Link href="/" className="serif text-xl text-ink-strong">
              NeuroScreen
            </Link>
            <nav className="flex gap-4 overflow-x-auto text-sm text-muted sm:gap-6">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-ink-strong">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
            <span>Research-use screening aid. Not a diagnostic device.</span>
            <span className="font-mono">NIE Mysore · ISE · BIS586 · 2026-27</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
