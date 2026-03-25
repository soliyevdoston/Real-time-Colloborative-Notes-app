import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Jamoaviy Note Ish Maydoni",
  description: "Real-time jamoaviy note ilovasi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <div className="texture-layer" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
