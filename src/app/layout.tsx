import type { Metadata, Viewport } from "next";
import { Geist, Poppins, Inter } from "next/font/google";
import "./globals.css";
import { PhoneFrame } from "@/components/PhoneFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// HelloFresh-stil: tunge, geometriske overskrifter (nærmeste gratis match til
// deres "Owners"-brandfont) og en ren humanist sans til UI/brødtekst.
const hfHeading = Poppins({
  variable: "--font-hf-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const hfBody = Inter({
  variable: "--font-hf-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hello Cal",
  description: "Kalorie- og måltidsregistrering",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${geistSans.variable} ${hfHeading.variable} ${hfBody.variable} h-full antialiased`}
    >
      <body className="min-h-full text-text-primary font-sans">
        <PhoneFrame>{children}</PhoneFrame>
      </body>
    </html>
  );
}
