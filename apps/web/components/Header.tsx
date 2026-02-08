"use client";

import { useSessionUser } from "./session";
import ProfileMenu from "./ProfileMenu";

export default function Header() {
  const { user, loading } = useSessionUser();

  if (loading || !user) {
    return null;
  }

  return (
    <header className="header">
      <div className="brand">Unified ETL</div>
      <nav className="grid" style={{ gridAutoFlow: "column", gap: 12, alignItems: "center" }}>
        <a href="/app">Dashboard</a>
        <a href="/datasets/new">New Dataset</a>
        <a href="/connectors">Connectors</a>
        <ProfileMenu />
      </nav>
    </header>
  );
}
