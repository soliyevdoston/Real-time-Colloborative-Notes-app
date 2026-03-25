import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Collaborative Notes Workspace",
  description: "Real-time collaborative notes app",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="texture-layer" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
