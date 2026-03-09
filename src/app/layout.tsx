import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlogForge — Council of Kings",
  description: "4 specialist AI agents that turn any question into a publish-ready blog post",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
