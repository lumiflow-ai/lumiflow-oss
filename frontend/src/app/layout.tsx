import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter_Tight, Roboto } from "next/font/google";

import { FontVariableNames } from "@/components/ui/fonts";

import { StyledComponentsRegistry } from "./StyledComponentsRegistry";

export const metadata: Metadata = {
  title: "Lumiflow AI",
};

const roboto = Roboto({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const inter = Inter_Tight({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${roboto.variable} ${ibmPlexSans.variable} ${inter.variable} `}
    >
      <head>
        <style>{`
          :root {
            ${FontVariableNames.sansSerif}: var(--font-geist-sans);
            ${FontVariableNames.monospace}: var(--font-geist-mono);
            --font-roboto: ${roboto.style.fontFamily};
            --font-ibm-plex-sans: ${ibmPlexSans.style.fontFamily};
            --font-inter: ${inter.style.fontFamily};
          }
        `}</style>
      </head>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
