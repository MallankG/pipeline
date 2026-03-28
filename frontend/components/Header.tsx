"use client";

import { useSessionUser } from "./session";

export default function Header() {
  const { user, loading } = useSessionUser();

  if (loading || !user) {
    return null;
  }

  return (
    <header className="header">
      <div className="brand">Unified ETL</div>
      <nav className="nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/datasets/new">New Dataset</a>
        <a href="/connectors">Connectors</a>
        <a href="/query">Query</a>
      </nav>
    </header>
  );
}
