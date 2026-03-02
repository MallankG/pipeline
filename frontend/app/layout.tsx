import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unified ETL Platform",
  description: "End-to-end ETL for AI/ML datasets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
