"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "./api";
import { getAccessToken } from "./session";

const SOURCE_PRESETS = [
  "Local Upload",
  "S3 / GCS / Azure",
  "Snowflake",
  "BigQuery",
  "Databricks",
  "Postgres",
  "MongoDB",
  "Kafka / Kinesis",
];

type Dataset = {
  id: string;
  data_types: string[];
};

export default function VersionActions({ datasetId, versionId }: { datasetId: string; versionId: string }) {
  const router = useRouter();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sourceType, setSourceType] = useState("Local Upload");
  const [sourceUri, setSourceUri] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [typeNotice, setTypeNotice] = useState<string | null>(null);

  const selectedFiles = files ? Array.from(files) : [];

  useEffect(() => {
    async function load() {
      const ds = await apiGet(`/datasets/${datasetId}`);
      setDataset(ds);
    }
    load();
  }, [datasetId]);

  function inferTypeFromFile(file: File): string | null {
    const name = file.name.toLowerCase();
    if (file.type.startsWith("image/") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp") || name.endsWith(".gif")) {
      return "image";
    }
    if (file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".jsonl") || name.endsWith(".csv") || name.endsWith(".md")) {
      return "text";
    }
    if (name.endsWith(".parquet") || name.endsWith(".npy") || name.endsWith(".npz")) {
      return "numerical";
    }
    return null;
  }

  function handleFilesChange(fl: FileList | null) {
    setFiles(fl);
    setTypeNotice(null);
    if (!fl) return;

    const inferred = new Set<string>();
    for (const file of Array.from(fl)) {
      const t = inferTypeFromFile(file);
      if (t) inferred.add(t);
    }

    if (inferred.size && dataset) {
      const current = new Set(dataset.data_types || []);
      inferred.forEach((t) => current.add(t));
      setDataset({ ...dataset, data_types: Array.from(current) });
      setTypeNotice("Detected file types and updated dataset types automatically.");
    }
  }

  async function uploadFiles() {
    if (!selectedFiles.length) {
      return [] as string[];
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const token = getAccessToken() || "";

    const uploadedUris: string[] = [];
    for (const file of selectedFiles) {
      const path = `datasets/${datasetId}/versions/${versionId}/uploads/${encodeURIComponent(file.name)}`;
      const res = await fetch(`${supabaseUrl}/storage/v1/object/raw/${path}`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: file,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      uploadedUris.push(`${supabaseUrl}/storage/v1/object/raw/${path}`);
    }
    return uploadedUris;
  }

  async function addData() {
    setStatus("Adding data...");
    if (sourceType === "Local Upload" && selectedFiles.length > 0) {
      const uploaded = await uploadFiles();
      await apiPost(`/datasets/${datasetId}/versions/${versionId}/assets`,
        uploaded.map((uri) => ({
          uri,
          media_type: "application/octet-stream",
          metadata: { source_type: "Local Upload" },
        }))
      );
    } else if (sourceUri) {
      await apiPost(`/datasets/${datasetId}/versions/${versionId}/sources`, {
        source_type: sourceType,
        source_uri: sourceUri,
        options: {},
      });
    }
    setStatus("✓ Data added successfully.");
    // Refresh asset count by triggering parent re-fetch via URL navigation
    router.refresh();
  }

  async function runPipeline() {
    setStatus("Starting pipeline…");
    try {
      const job = await apiPost(`/datasets/${datasetId}/versions/${versionId}/jobs`, { type: "PIPELINE_RUN" });
      await apiPost(`/jobs/${job.id}/run`, {});
      // Navigate to curate page which has live WebSocket + polling
      router.push(`/datasets/${datasetId}/curate/${versionId}`);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Failed to start pipeline");
    }
  }

  return (
    <div className="card">
      <div className="section-title">Add data to this version</div>
      <div className="form-section">
        <div>
          <label>Source Type</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {SOURCE_PRESETS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {sourceType === "Local Upload" ? (
          <div className="upload-drop">
            <label>Upload Files</label>
            <input
              type="file"
              multiple
              onChange={(e) => handleFilesChange(e.target.files)}
            />
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#6a625a" }}>
                {selectedFiles.length} files selected
              </div>
            )}
          </div>
        ) : (
          <div>
            <label>Source URI / Connection</label>
            <input
              value={sourceUri}
              onChange={(e) => setSourceUri(e.target.value)}
              placeholder="s3://bucket/path or postgres://user:pass@host:5432/db"
            />
          </div>
        )}
        {typeNotice && <div className="alert info">{typeNotice}</div>}
        <button className="btn" onClick={addData}>Add Data</button>
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>Pipeline</div>
      <div className="inline-actions">
        <button className="btn secondary" onClick={runPipeline}>Run ETL Pipeline</button>
        <a className="btn ghost" href={`/datasets/${datasetId}/curate/${versionId}`}>View Curation</a>
      </div>
      {status && <div style={{ marginTop: 10 }} className="alert info">{status}</div>}
    </div>
  );
}
