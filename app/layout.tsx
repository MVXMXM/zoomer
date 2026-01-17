import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoomer - Semantic Zoom for Text",
  description: "Expand or contract text while preserving meaning using AI-powered semantic zoom.",
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
