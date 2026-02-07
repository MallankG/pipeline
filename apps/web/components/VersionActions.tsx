"use client";

import { useState } from "react";
import { apiPost } from "./api";

export default function VersionActions({ datasetId, versionId }: { datasetId: string; versionId: string }) {
  const [uri, setUri] = useState("");
  const [mediaType, setMediaType] = useState("image/png");
  const [status, setStatus] = useState<string | null>(null);

  async function addAsset() {
    const asset = { uri, media_type: mediaType, metadata: {} };
    await apiPost(`/datasets/${datasetId}/versions/${versionId}/assets`, [asset]);
    setStatus("Asset added");
    window.location.reload();
  }

  async function runPipeline() {
    const job = await apiPost(`/datasets/${datasetId}/versions/${versionId}/jobs`, { type: "PIPELINE_RUN" });
    await apiPost(`/jobs/${job.id}/run`, {});
    setStatus("Pipeline running");
    window.location.reload();
  }

  return (
    <div className="card">
      <div className="section-title">Add Assets</div>
      <label>URI (file:///absolute/path or s3://...)</label>
      <input value={uri} onChange={(e) => setUri(e.target.value)} />
      <label>Media Type</label>
      <select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
        <option value="image/png">image/png</option>
        <option value="image/jpeg">image/jpeg</option>
        <option value="text/plain">text/plain</option>
        <option value="text/csv">text/csv</option>
      </select>
      <button className="btn" onClick={addAsset} style={{ marginTop: 10 }}>Add Asset</button>

      <div className="section-title" style={{ marginTop: 20 }}>Pipeline</div>
      <button className="btn secondary" onClick={runPipeline}>Run ETL Pipeline</button>
      {status && <div style={{ marginTop: 10 }}>{status}</div>}
    </div>
  );
}
