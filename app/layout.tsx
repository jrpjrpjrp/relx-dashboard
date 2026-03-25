import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RELX Group — Financial Dashboard",
  description:
    "Strategic financial analysis for RELX Group plc (LSE: REL) — group and segment performance across Risk, STM, Legal, and Exhibitions from SEC EDGAR filings.",
  openGraph: {
    title: "RELX Group — Financial Dashboard",
    description:
      "Strategic financial analysis for RELX Group plc (LSE: REL) — group and segment performance across Risk, STM, Legal, and Exhibitions from SEC EDGAR filings.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RELX Group — Financial Dashboard",
    description:
      "Strategic financial analysis for RELX Group plc (LSE: REL) — group and segment performance across Risk, STM, Legal, and Exhibitions from SEC EDGAR filings.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${robotoMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
