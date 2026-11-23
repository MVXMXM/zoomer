import type { Metadata } from "next";
import "@mvxmxm/maxos/segmented-controller.css";
import "@mvxmxm/maxos/slider-scale.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoomer - Semantic Zoom for Text",
  description: "Expand or contract text while preserving meaning using AI-powered semantic zoom.",
  openGraph: {
    type: "website",
    siteName: "Zoomer",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
