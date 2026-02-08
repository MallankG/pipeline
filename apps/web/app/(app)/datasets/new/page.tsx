"use client";

import { useState } from "react";
import { apiPost } from "@/components/api";
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

export default function NewDatasetPage() {
  const { user, loading } = useSessionUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>(["image", "text", "numerical"]);
  const [output, setOutput] = useState("{\n  \"images\": \"coco\",\n  \"text\": \"jsonl\",\n  \"numerical\": \"parquet\"\n}");
  const [sourceType, setSourceType] = useState("Local Upload");
  const [sourceUri, setSourceUri] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [typeNotice, setTypeNotice] = useState<string | null>(null);

  const selectedFiles = files ? Array.from(files) : [];

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setStatus("Please sign in first.");
      return;
    }
    setStatus("Creating dataset...");
    const payload = { name, description, data_types: dataTypes };
    const ds = await apiPost("/datasets", payload);
    const target_output = JSON.parse(output);
    const version = await apiPost(`/datasets/${ds.id}/versions`, { target_output });

    if (sourceType === "Local Upload" && selectedFiles.length > 0) {
      setStatus("Uploading files...");
      const uploaded = await uploadFiles(ds.id, version.id);
      await apiPost(`/datasets/${ds.id}/versions/${version.id}/assets`,
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

    window.location.href = `/datasets/${ds.id}/curate/${version.id}`;
  }

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> before creating a dataset.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">Create Dataset</div>
        <div className="stepper">
          <div className="step">Basics</div>
          <div className="step">Data Types</div>
          <div className="step">Sources</div>
          <div className="step">Output</div>
        </div>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-3">
            <label><input type="checkbox" checked={dataTypes.includes("image")} onChange={() => toggle("image")} /> Images</label>
            <label><input type="checkbox" checked={dataTypes.includes("text")} onChange={() => toggle("text")} /> Text</label>
            <label><input type="checkbox" checked={dataTypes.includes("numerical")} onChange={() => toggle("numerical")} /> Numerical</label>
          </div>
          {typeNotice && <div className="badge">{typeNotice}</div>}
          <div>
            <label>Data Source</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {sourceType === "Local Upload" ? (
            <div>
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
          <div>
            <label>Target Output</label>
            <textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={6} />
          </div>
          <button className="btn" type="submit">Create and Start Curation</button>
          {status && <div>{status}</div>}
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
