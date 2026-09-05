import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  applicationName: "Esker Operations",
  title: {
    default: "Esker Operations",
    template: "%s · Esker Operations",
  },
  description: "Fleet, plant and compliance operations for Esker Readymix",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Esker Ops",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ed7b00",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
