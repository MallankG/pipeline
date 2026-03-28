"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/components/api";
import { useSessionUser } from "@/components/session";
import PageLoader from "@/components/PageLoader";

const CONNECTORS = [
  { id: "S3", label: "S3 / GCS / Azure Blob", hint: "s3://bucket/path or gs://bucket/path" },
  { id: "Snowflake", label: "Snowflake", hint: "snowflake://account/db/schema?warehouse=..." },
  { id: "BigQuery", label: "BigQuery", hint: "bq://project.dataset.table" },
  { id: "Databricks", label: "Databricks", hint: "databricks://workspace/catalog/schema" },
  { id: "Postgres", label: "Postgres", hint: "postgres://user:pass@host:5432/db" },
  { id: "MongoDB", label: "MongoDB", hint: "mongodb://user:pass@host:27017/db" },
  { id: "Kafka", label: "Kafka / Kinesis", hint: "kafka://broker/topic or kinesis://stream" },
];

type Dataset = {
  id: string;
  name: string;
};

type Version = {
  id: string;
  version: number;
};

export default function ConnectorsPage() {
  const { user, loading: authLoading } = useSessionUser();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null); // null = loading
  const [versions, setVersions] = useState<Version[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [sourceType, setSourceType] = useState(CONNECTORS[0].id);
  const [sourceUri, setSourceUri] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiGet("/datasets")
      .then((ds) => setDatasets(ds || []))
      .catch((err: unknown) => {
        setStatus(err instanceof Error ? err.message : "Failed to load datasets");
        setDatasets([]);
      });
  }, [user]);

  useEffect(() => {
    async function loadVersions() {
      if (!datasetId) {
        setVersions([]);
        return;
      }
      try {
        const vs = await apiGet(`/datasets/${datasetId}/versions`);
        setVersions(vs || []);
        if (vs && vs.length > 0) {
          setVersionId(vs[0].id);
        }
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : "Failed to load versions");
      }
    }
    loadVersions();
  }, [datasetId]);

  async function addSource() {
    if (!datasetId || !versionId) {
      setStatus("Dataset and version are required.");
      return;
    }
    try {
      await apiPost(`/datasets/${datasetId}/versions/${versionId}/sources`, {
        source_type: sourceType,
        source_uri: sourceUri,
        options: {},
      });
      setStatus("Source added. It will be used in curation.");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Failed to add source");
    }
  }

  if (authLoading) return <PageLoader lines={2} />;

  if (!user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to manage connectors.</div>
      </main>
    );
  }

  if (datasets === null) return <PageLoader lines={2} />;

  const selected = CONNECTORS.find((c) => c.id === sourceType);

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="page-title">Connect data sources</div>
        <div className="muted">Attach warehouses, lakes, and streams to a dataset version.</div>
      </section>

      <section className="card">
        <div className="section-title">Source Configuration</div>
        <div className="grid">
          <div>
            <label>Dataset</label>
            <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
              <option value="">Select dataset</option>
              {(datasets ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Version</label>
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version}</option>
              ))}
            </select>
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
          {status && <div className="alert info">{status}</div>}
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
