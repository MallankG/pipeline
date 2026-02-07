"use client";

import { useState } from "react";
import { apiPost } from "../../components/api";
import { useSessionUser } from "../../components/session";

const CONNECTORS = [
  { id: "S3", label: "S3 / GCS / Azure Blob", hint: "s3://bucket/path or gs://bucket/path" },
  { id: "Snowflake", label: "Snowflake", hint: "snowflake://account/db/schema?warehouse=..." },
  { id: "BigQuery", label: "BigQuery", hint: "bq://project.dataset.table" },
  { id: "Databricks", label: "Databricks", hint: "databricks://workspace/catalog/schema" },
  { id: "Postgres", label: "Postgres", hint: "postgres://user:pass@host:5432/db" },
  { id: "MongoDB", label: "MongoDB", hint: "mongodb://user:pass@host:27017/db" },
  { id: "Kafka", label: "Kafka / Kinesis", hint: "kafka://broker/topic or kinesis://stream" },
];

export default function ConnectorsPage() {
  const { user, loading } = useSessionUser();
  const [datasetId, setDatasetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [sourceType, setSourceType] = useState(CONNECTORS[0].id);
  const [sourceUri, setSourceUri] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function addSource() {
    if (!datasetId || !versionId) {
      setStatus("Dataset ID and Version ID are required.");
      return;
    }
    await apiPost(`/datasets/${datasetId}/versions/${versionId}/sources`, {
      source_type: sourceType,
      source_uri: sourceUri,
      options: {},
    });
    setStatus("Source added.");
  }

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to manage connectors.</div>
      </main>
    );
  }

  const selected = CONNECTORS.find((c) => c.id === sourceType);

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">Connect Data Sources</div>
        <div className="stepper">
          <div className="step">Select Connector</div>
          <div className="step">Add Credentials</div>
          <div className="step">Validate</div>
        </div>
        <div style={{ marginTop: 10, color: "#6a625a" }}>
          This is a connector registry view. It stores the source metadata for a dataset version.
        </div>
      </section>

      <section className="card">
        <div className="section-title">Source Configuration</div>
        <div className="grid">
          <div>
            <label>Dataset ID</label>
            <input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <label>Version ID</label>
            <input value={versionId} onChange={(e) => setVersionId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <label>Connector</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {CONNECTORS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Connection URI</label>
            <input value={sourceUri} onChange={(e) => setSourceUri(e.target.value)} placeholder={selected?.hint} />
          </div>
          <button className="btn" onClick={addSource}>Add Source</button>
          {status && <div>{status}</div>}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Supported Sources</div>
        <div className="logo-grid">
          {CONNECTORS.map((c) => (
            <div key={c.id} className="logo-pill">{c.label}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
