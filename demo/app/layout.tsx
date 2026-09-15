import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Riverside Family Dental, AI front desk",
  description:
    "A live demonstration of a HIPAA aware AI dental receptionist: the call, the schedule it writes to, and the compliance trail it leaves behind.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eef0" },
    { media: "(prefers-color-scheme: dark)", color: "#080f11" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Fonts are linked rather than bundled so a build never depends on
          network access, and every family has a real fallback stack in
          globals.css if the link does not resolve on the demo machine.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
