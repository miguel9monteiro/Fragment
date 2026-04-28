import "@/styles/globals.css";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pmc-knowledge.vercel.app"),
  title: {
    default: "PMC Knowledge — Portfolio Management Club, Nova SBE",
    template: "%s · PMC Knowledge",
  },
  description:
    "An institutional learning resource for the Portfolio Management Club at Nova School of Business & Economics. Modules, pitch archive, and glossary for sharper equity research.",
  authors: [{ name: "Portfolio Management Club, Nova SBE" }],
  openGraph: {
    title: "PMC Knowledge",
    description:
      "Modules, pitch archive, and glossary for the Portfolio Management Club at Nova SBE.",
    type: "website",
    siteName: "PMC Knowledge",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          serif.variable,
          mono.variable,
          "min-h-screen flex flex-col antialiased",
        )}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
