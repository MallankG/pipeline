"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/components/api";
import { getAccessToken, useSessionUser } from "@/components/session";

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
  name: string;
};

export default function NewDatasetPage() {
  const { user, loading } = useSessionUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [output, setOutput] = useState("{\n  \"images\": \"coco\",\n  \"text\": \"jsonl\",\n  \"numerical\": \"parquet\"\n}");
  const [sourceType, setSourceType] = useState("Local Upload");
  const [sourceUri, setSourceUri] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [typeNotice, setTypeNotice] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const selectedFiles = files;

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const result = await apiGet("/datasets");
        setDatasets(result || []);
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : "Failed to load datasets");
      }
    }
    load();
  }, [user]);

  const nameExists = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return false;
    return datasets.some((d) => d.name.toLowerCase() === trimmed);
  }, [datasets, name]);

  function inferTypeFromFile(file: File): string | null {
    const fileName = file.name.toLowerCase();
    if (file.type.startsWith("image/") || fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".webp") || fileName.endsWith(".gif")) {
      return "image";
    }
    if (file.type.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".jsonl") || fileName.endsWith(".csv") || fileName.endsWith(".md")) {
      return "text";
    }
    if (fileName.endsWith(".parquet") || fileName.endsWith(".npy") || fileName.endsWith(".npz")) {
      return "numerical";
    }
    return null;
  }

  function handleFilesChange(fl: FileList | null) {
    setFiles(fl ? Array.from(fl) : []);
    setTypeNotice(null);
    if (!fl) return;

    const inferred = new Set<string>();
    for (const file of Array.from(fl)) {
      const t = inferTypeFromFile(file);
      if (t) inferred.add(t);
    }

    if (inferred.size) {
      setDataTypes((prev) => {
        const set = new Set(prev);
        inferred.forEach((t) => set.add(t));
        return Array.from(set);
      });
      setTypeNotice("Detected file types and updated dataset types automatically.");
    }
  }

  function toggle(type: string) {
    setDataTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function uploadFiles(datasetId: string, versionId: string) {
    if (!selectedFiles.length) {
      return [] as string[];
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const token = getAccessToken() || "";

    const uploadedUris: string[] = [];
    for (const file of selectedFiles) {
      const path = `datasets/${datasetId}/versions/${versionId}/uploads/${encodeURIComponent(file.name)}`;
      const res = await fetch(`${supabaseUrl}/storage/v1/object/${path}`, {
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
        let text = "";
        try { text = await res.text(); } catch(e) {}
        throw new Error(text || "Upload failed");
      }
      uploadedUris.push(`${supabaseUrl}/storage/v1/object/authenticated/${path}`);
    }
    return uploadedUris;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setStatus("Please sign in first.");
      return;
    }
    if (dataTypes.length === 0) {
      setStatus("Select at least one data type before continuing.");
      return;
    }
    if (nameExists) {
      setStatus("Dataset name already exists. Choose a different name.");
      return;
    }
    setStatus("Creating dataset...");
    try {
      const payload = { name, description, data_types: dataTypes };
      const ds = await apiPost("/datasets", payload);
      const target_output = JSON.parse(output);
      const version = await apiPost(`/datasets/${ds.id}/versions`, { target_output });

      if (sourceType === "Local Upload" && selectedFiles.length > 0) {
        setStatus("Uploading files...");
        const uploaded = await uploadFiles(ds.id, version.id);
        await apiPost(
          `/datasets/${ds.id}/versions/${version.id}/assets`,
          uploaded.map((uri) => ({
            uri,
            media_type: "application/octet-stream",
            metadata: { source_type: "Local Upload" },
          }))
        );
      } else if (sourceUri) {
        await apiPost(`/datasets/${ds.id}/versions/${version.id}/sources`, {
          source_type: sourceType,
          source_uri: sourceUri,
          options: {},
        });
      }

      setStatus("Starting pipeline...");
      const job = await apiPost(`/datasets/${ds.id}/versions/${version.id}/jobs`, { type: "PIPELINE_RUN" });
      await apiPost(`/jobs/${job.id}/run`, {});

      window.location.href = `/datasets/${ds.id}/curate/${version.id}`;
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Failed to create dataset");
    }
  }

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> before creating a dataset.</div>
      </main>
    );
  }

  return (
    <main className="grid fade-up" style={{ gap: 24 }}>
      <section className="card">
        <div className="toolbar">
          <div>
            <div className="page-title">Create dataset</div>
            <div className="muted" style={{ marginTop: "8px" }}>Define data types, connect sources, and launch a curated version.</div>
          </div>
        </div>
        <div className="stepper" style={{ marginTop: 16 }}>
          <div className="step">Basics</div>
          <div className="step">Data Types</div>
          <div className="step">Sources</div>
          <div className="step">Output</div>
        </div>
      </section>

      <section className="card">
        <form className="grid" onSubmit={onSubmit}>
          <div className="form-section">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
            {nameExists && <div className="alert warn">Name already exists. Choose a unique dataset name.</div>}
          </div>

          <div className="form-section">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="form-section">
            <label>Data Types</label>
            <div className="type-grid">
              <button
                type="button"
                className={`type-card ${dataTypes.includes("image") ? "active" : ""}`}
                onClick={() => toggle("image")}
              >
                <div className="type-meta">
                  <div className="type-title">Images</div>
                  <div className="muted">PNG, JPG, WebP, COCO, YOLO</div>
                </div>
                <div className="badge">{dataTypes.includes("image") ? "Selected" : "Select"}</div>
              </button>
              <button
                type="button"
                className={`type-card ${dataTypes.includes("text") ? "active" : ""}`}
                onClick={() => toggle("text")}
              >
                <div className="type-meta">
                  <div className="type-title">Text</div>
                  <div className="muted">JSONL, CSV, plain text</div>
                </div>
                <div className="badge">{dataTypes.includes("text") ? "Selected" : "Select"}</div>
              </button>
              <button
                type="button"
                className={`type-card ${dataTypes.includes("numerical") ? "active" : ""}`}
                onClick={() => toggle("numerical")}
              >
                <div className="type-meta">
                  <div className="type-title">Numerical</div>
                  <div className="muted">Parquet, NPY, tabular</div>
                </div>
                <div className="badge">{dataTypes.includes("numerical") ? "Selected" : "Select"}</div>
              </button>
            </div>
            {typeNotice && <div className="alert info">{typeNotice}</div>}
          </div>

          <div className="form-section">
            <label>Data Source</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {sourceType === "Local Upload" ? (
              <div className="upload-drop" key="upload-source">
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
              <div key="remote-source">
                <label>Source URI / Connection</label>
                <input
                  value={sourceUri}
                  onChange={(e) => setSourceUri(e.target.value)}
                  placeholder="s3://bucket/path or postgres://user:pass@host:5432/db"
                />
              </div>
            )}
          </div>

          <div className="form-section">
            <label>Target Output</label>
            <textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={6} />
          </div>

          <div className="inline-actions">
            <button className="btn" type="submit">Create and Start Curation</button>
            <a className="btn secondary" href="/dashboard">View existing datasets</a>
          </div>
          {status && <div className="alert info">{status}</div>}
        </form>
      </section>

      <section className="card">
        <div className="section-title">Recommended Setup</div>
        <div className="grid">
          <div className="stat">
            <strong>Images</strong>
            <div>COCO or YOLO exports for detection/classification</div>
          </div>
          <div className="stat">
            <strong>Text</strong>
            <div>JSONL + HuggingFace Dataset</div>
          </div>
          <div className="stat">
            <strong>Numerical</strong>
            <div>Parquet for fast analytics and training</div>
          </div>
        </div>
      </section>
    </main>
  );
}
