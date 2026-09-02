import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Esker Operations",
  description: "Fleet, plant and compliance operations for Esker Readymix",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
