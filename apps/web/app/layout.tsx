import "./globals.css";
import type { Metadata } from "next";
import AuthStatus from "../components/AuthStatus";

export const metadata: Metadata = {
  title: "Unified ETL Platform",
  description: "End-to-end ETL for AI/ML datasets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <div className="brand">Unified ETL</div>
            <nav className="grid" style={{ gridAutoFlow: "column", gap: 12, alignItems: "center" }}>
              <a href="/">Home</a>
              <a href="/app">Dashboard</a>
              <a href="/datasets/new">New Dataset</a>
              <a href="/connectors">Connectors</a>
              <a href="/auth">Auth</a>
              <AuthStatus />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
