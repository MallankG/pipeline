"use client";

import { useState } from "react";
import { apiPost } from "./api";

export default function CreateVersion({ datasetId }: { datasetId: string }) {
  const [output, setOutput] = useState("{\n  \"images\": \"coco\",\n  \"text\": \"jsonl\",\n  \"numerical\": \"parquet\"\n}");
  const [status, setStatus] = useState<string | null>(null);

  async function create() {
    setStatus("Creating version...");
    const target_output = JSON.parse(output);
    const res = await apiPost(`/datasets/${datasetId}/versions`, { target_output });
    window.location.href = `/datasets/${datasetId}/versions/${res.id}`;
  }

  return (
    <div className="card">
      <div className="section-title">Create a new version</div>
      <div className="form-section">
        <label>Target Output</label>
        <textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={6} />
        <div className="inline-actions">
          <button className="btn" onClick={create}>Create Version</button>
          <a className="btn secondary" href="/connectors">Add Sources</a>
        </div>
        {status && <div className="alert info">{status}</div>}
      </div>
    </div>
  );
}
