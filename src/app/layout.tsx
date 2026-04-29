import type { Metadata } from "next";
import { Inter, Noto_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Noto Serif er Googles offisielle etterfølger til Droid Serif — vi bruker
// den som display-font (hero-overskriften på innloggingssida) til vi
// eventuelt henter inn Texta Pro / Droid Serif via MyFonts-lisens.
const notoSerif = Noto_Serif({
  variable: "--font-droid-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DAM Søknadshjelpe",
  description:
    "Internt arbeidsverktøy for sekretariatet i CP-foreningen. Vurder, forbedre og følg opp søknader til Stiftelsen Dam.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${inter.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg-app text-ink-1">{children}</body>
    </html>
  );
}
