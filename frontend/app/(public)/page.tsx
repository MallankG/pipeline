"use client";

import { useEffect } from "react";
import { useSessionUser } from "@/components/session";

export default function LandingPage() {
  const { user, loading } = useSessionUser();

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/dashboard";
    }
  }, [loading, user]);

  return (
    <main className="hero fade-up">
      <section>
        <div className="badgeing" style={{ marginBottom: "24px" }}>
          <span className="badge">Unified ETL for AI data</span>
        </div>
        <h1>Turn raw datasets into training-ready assets in minutes.</h1>
        <p>
          Ingest images, text, and numerical data. Validate, normalize, label, version, and export with a single flow.
        </p>
        <div className="inline-actions" style={{ marginBottom: "48px" }}>
          <a className="btn" href="/auth">Get Started</a>
          <a className="btn secondary" href="/auth">Sign In</a>
        </div>

        <div className="flow">
          <div className="flow-item">
            <div className="flow-dot pulsing" />
            <div>Connect files, warehouses, lakes, streams, and databases in one place.</div>
          </div>
          <div className="flow-item">
            <div className="flow-dot pulsing" />
            <div>Auto-check schemas, detect types, and fix mismatches on the fly.</div>
          </div>
          <div className="flow-item">
            <div className="flow-dot pulsing" />
            <div>Ship COCO, YOLO, JSONL, Parquet with lineage and versioning.</div>
          </div>
        </div>

        <div className="logo-grid">
          <div className="logo-pill">S3 / GCS / Azure</div>
          <div className="logo-pill">Snowflake</div>
          <div className="logo-pill">BigQuery</div>
          <div className="logo-pill">Databricks</div>
          <div className="logo-pill">Postgres</div>
          <div className="logo-pill">MongoDB</div>
          <div className="logo-pill">Kafka</div>
          <div className="logo-pill">Kinesis</div>
        </div>
      </section>

      <aside className="hero-panel floating">
        <div className="badge pulsing">Live pipeline snapshot</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 24, marginBottom: 16 }}>
          Dataset: Product Reviews
        </div>
        <div className="kpi">
          <span className="muted">Records</span>
          <strong style={{ fontSize: "18px" }}>248,940</strong>
        </div>
        <div className="kpi">
          <span className="muted">Data types</span>
          <strong style={{ fontSize: "18px" }}>Text, Numerical</strong>
        </div>
        <div className="kpi">
          <span className="muted">Status</span>
          <strong style={{ fontSize: "18px", color: "var(--accent-2)" }}>Curating...</strong>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Exports</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="tag">JSONL + HF Dataset <span style={{ color: "var(--accent)", marginLeft: "auto" }}>Ready</span></div>
            <div className="tag">Parquet + Manifest <span style={{ color: "var(--accent-2)", marginLeft: "auto" }}>Processing</span></div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 24, background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Pipeline Signals</div>
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div className="tag" style={{ border: "1px solid rgba(139, 92, 246, 0.3)", background: "rgba(139, 92, 246, 0.1)" }}>Schema: Verified</div>
            <div className="tag" style={{ border: "1px solid rgba(59, 130, 246, 0.3)", background: "rgba(59, 130, 246, 0.1)" }}>Auto-labeling: Active</div>
            <div className="tag" style={{ border: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(255, 255, 255, 0.05)" }}>EDA: Generating...</div>
          </div>
        </div>
      </aside>
    </main>
  );
}
