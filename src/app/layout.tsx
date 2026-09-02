import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PhoneFrame } from "@/components/PhoneFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// HelloFresh uses SF Pro (the system font on Apple devices). --font-hf-heading
// and --font-hf-body are set directly in globals.css to the same system-font
// stack instead of a loaded Google Font, per hellofresh_typografi_og_farver.txt.

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
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full text-text-primary font-sans">
        <PhoneFrame>{children}</PhoneFrame>
      </body>
    </html>
  );
}
