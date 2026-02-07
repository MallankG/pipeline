"use client";

import { useState } from "react";
import { apiPost } from "./api";

export default function CreateVersion({ datasetId }: { datasetId: string }) {
  const [output, setOutput] = useState("{\n  \"images\": \"coco\",\n  \"text\": \"jsonl\",\n  \"numerical\": \"parquet\"\n}");

  async function create() {
    const target_output = JSON.parse(output);
    const res = await apiPost(`/datasets/${datasetId}/versions`, { target_output });
    window.location.href = `/datasets/${datasetId}/versions/${res.id}`;
  }

  return (
    <div className="card">
      <div className="section-title">Create Version</div>
      <label>Target Output</label>
      <textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={6} />
      <button className="btn" onClick={create} style={{ marginTop: 10 }}>Create Version</button>
    </div>
  );
}
