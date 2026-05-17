import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Syntrix AI - The Future of AI Conversations",
    template: "%s | Syntrix AI"
  },
  description: "A premium AI SaaS platform with streaming chat, demo auth, Razorpay billing, and admin analytics.",
  openGraph: {
    description: "ChatGPT, Claude, and Perplexity-inspired AI workspace for production SaaS teams.",
    siteName: "Syntrix AI",
    title: "Syntrix AI",
    type: "website"
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
