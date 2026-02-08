"use client";

import { usePathname } from "next/navigation";
import AuthStatus from "./AuthStatus";
import { useSessionUser } from "./session";

export default function Header() {
  const pathname = usePathname();
  const { user, loading } = useSessionUser();

  if (pathname === "/" || pathname === "/auth") {
    return null;
  }

  if (!loading && !user) {
    return null;
  }

  return (
    <header className="header">
      <div className="brand">Unified ETL</div>
      <nav className="grid" style={{ gridAutoFlow: "column", gap: 12, alignItems: "center" }}>
        <a href="/app">Dashboard</a>
        <a href="/datasets/new">New Dataset</a>
        <a href="/connectors">Connectors</a>
        <AuthStatus />
      </nav>
    </header>
  );
}
