"use client";

import { useEffect } from "react";
import { useSessionUser } from "@/components/session";

const STAGES = [
  { label: "Connect", text: "Bring in files, warehouses, and streams." },
  { label: "Curate", text: "Validate, normalize, and label in one pass." },
  { label: "Export", text: "Ship versioned artifacts with lineage." },
];

export default function LandingPage() {
  const { user, loading } = useSessionUser();

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/dashboard";
    }
  }, [loading, user]);

  return (
    <main className="poster-shell fade-up">
      <header className="poster-topbar">
        <div className="poster-brand">
          <span>Unified ETL</span>
          <strong>Unified ETL</strong>
        </div>
        <nav className="poster-nav">
          <span>AI dataset operations</span>
          <a href="/auth">Sign In</a>
        </nav>
      </header>

      <section className="poster-hero">
        <div className="poster-copy">
          <div className="badge">One-screen workflow</div>
          <h1 className="poster-title">From raw source to training-ready dataset in one controlled route.</h1>
          <p className="poster-summary">
            Ingest images, text, and tabular data, watch curation move stage by stage, then export the exact format your training stack expects.
          </p>
          <div className="inline-actions">
            <a className="btn" href="/auth">Start a dataset</a>
            <a className="btn secondary" href="/auth">Open workspace</a>
          </div>
        </div>

        <div className="poster-visual floating">
          <div className="poster-orbit" />
          <div className="poster-grid">
            <div className="poster-grid-head">
              <div>
                <div className="badge">Dataset version</div>
                <h2 className="section-title" style={{ marginTop: 12 }}>Retail Reviews v3</h2>
              </div>
              <span className="poster-status">Live</span>
            </div>

            <div className="poster-stats">
              <div>
                <span>Records</span>
                <strong>248,940</strong>
              </div>
              <div>
                <span>Sources</span>
                <strong>Snowflake + S3</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>JSONL + Parquet</strong>
              </div>
            </div>

            <div className="poster-track">
              {STAGES.map((stage, index) => (
                <div className="poster-track-row" key={stage.label}>
                  <div className="poster-index">{index + 1}</div>
                  <div>
                    <strong>{stage.label}</strong>
                    <span>{stage.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="poster-footer">
              <div>
                <span>Supported</span>
                <strong>Image, text, numerical, multimodal</strong>
              </div>
              <div>
                <span>Security</span>
                <strong>Auth with owner-scoped RLS</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
