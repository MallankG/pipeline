"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  id: string;
  name: string;
  data_types: string[];
  created_at: string;
  description?: string;
};

export default function DashboardPage() {
  const { user, loading } = useSessionUser();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) {
        setDatasets([]);
        return;
      }
      try {
        const result = await apiGet("/datasets");
        setDatasets(result || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load datasets");
      }
    }
    load();
  }, [user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access your dashboard.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="banner">
        <div>
          <strong>Welcome back.</strong> Your datasets and pipelines live here.
        </div>
        <a className="btn" href="/datasets/new">Create Dataset</a>
      </section>

      {error && <section className="card" style={{ color: "#b60000" }}>{error}</section>}

      <section className="grid grid-3">
        <a className="card" href="/datasets/new">
          <div className="section-title">New Dataset</div>
          <div>Start a new ETL pipeline with guided setup.</div>
          <div style={{ marginTop: 12 }} className="badge">Create</div>
        </a>

        {datasets.map((d) => (
          <a key={d.id} className="card" href={`/datasets/${d.id}`}>
            <div className="section-title">{d.name}</div>
            <div style={{ color: "#6a625a" }}>{d.description || "No description"}</div>
            <div style={{ marginTop: 12 }} className="badge">{(d.data_types || []).join(", ")}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6a625a" }}>
              Created {new Date(d.created_at).toLocaleString()}
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
