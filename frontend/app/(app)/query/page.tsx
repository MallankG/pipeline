"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import PageLoader from "@/components/PageLoader";

type Dataset = { id: string; name: string; description?: string };

export default function QueryIndexPage() {
  const { user, loading: authLoading } = useSessionUser();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);

  useEffect(() => {
    if (!user) return;
    apiGet("/datasets")
      .then((r) => setDatasets(r || []))
      .catch(() => setDatasets([]));
  }, [user]);

  if (authLoading) return <PageLoader lines={1} />;

  if (!user) {
    return (
      <main className="card fade-up" style={{ textAlign: "center", padding: "40px" }}>
        <p>Please <a href="/auth">sign in</a> to use the query interface.</p>
      </main>
    );
  }

  if (datasets === null) return <PageLoader lines={1} />;

  return (
    <main className="grid fade-up" style={{ gap: 32 }}>
      <section className="card">
        <h1 className="page-title">Query your data</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Select a dataset to start asking questions in plain English. The AI will translate your questions into SQL and summarise the results.
        </div>
      </section>

      {datasets.length === 0 ? (
        <section className="card" style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 16 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No datasets yet</div>
          <div className="muted" style={{ marginBottom: 20 }}>Create a dataset to start querying your data.</div>
          <a href="/datasets/new" className="btn">Create Dataset</a>
        </section>
      ) : (
        <section className="card-grid">
          {datasets.map((d) => (
            <a
              key={d.id}
              href={`/datasets/${d.id}/query`}
              className="card"
              style={{ display: "flex", flexDirection: "column", gap: 8, textDecoration: "none" }}
            >
              <div style={{ fontSize: "1.5rem" }}>📊</div>
              <div className="card-title">{d.name}</div>
              <div className="muted" style={{ fontSize: "0.88rem", flex: 1 }}>
                {d.description || "No description."}
              </div>
              <div style={{ marginTop: 12, fontSize: "0.8rem", fontWeight: 700, color: "var(--accent-strong)", letterSpacing: "0.04em" }}>
                Query this dataset →
              </div>
            </a>
          ))}
        </section>
      )}
    </main>
  );
}
