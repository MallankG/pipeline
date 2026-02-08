export default function LandingPage() {
  return (
    <main className="hero fade-up">
      <section>
        <div className="badge">Unified ETL for AI data</div>
        <h1>Turn raw datasets into training-ready assets in minutes.</h1>
        <p>
          Ingest images, text, and numerical data. Validate, normalize, label, version, and export with a single flow.
        </p>
        <div className="grid" style={{ gridAutoFlow: "column", gap: 12, justifyContent: "start" }}>
          <a className="btn" href="/auth">Get Started</a>
        </div>

        <div className="flow">
          <div className="flow-item">
            <div className="flow-dot" />
            <div>Connect sources: files, warehouses, lakes, streams, databases</div>
          </div>
          <div className="flow-item">
            <div className="flow-dot" />
            <div>Curate, label, and version with transparent lineage</div>
          </div>
          <div className="flow-item">
            <div className="flow-dot" />
            <div>Ship outputs to COCO/YOLO/JSONL/Parquet</div>
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

      <aside className="hero-panel">
        <div className="badge">Live pipeline snapshot</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>
          Dataset: Product Reviews
        </div>
        <div className="kpi">
          <span>Records</span>
          <strong>248,940</strong>
        </div>
        <div className="kpi">
          <span>Data types</span>
          <strong>Text, Numerical</strong>
        </div>
        <div className="kpi">
          <span>Status</span>
          <strong>Curating</strong>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="badge">Exports</div>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div className="badge">JSONL + HF Dataset</div>
            <div className="badge">Parquet + Manifest</div>
          </div>
        </div>
      </aside>
    </main>
  );
}
