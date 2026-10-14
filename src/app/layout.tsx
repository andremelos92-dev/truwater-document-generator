import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Truwater Document Generator",
  description:
    "Fill in the project details and download the Truwater RFQ or Technical Proposal as a Word document.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
