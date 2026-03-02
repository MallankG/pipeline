"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Asset = {
  id: string;
  uri: string;
  media_type: string;
};

export default function LabelPage() {
  const params = useParams<{ datasetId: string; versionId: string }>();
  const datasetId = params?.datasetId;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      const res = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      setAssets(res || []);
    }
    load();
  }, [datasetId, versionId, user]);

  async function saveLabel(assetId: string) {
    const label = labels[assetId] || "";
    await apiPost(`/datasets/${datasetId}/versions/${versionId}/labels/${assetId}`, {
      label_type: "manual",
      payload: { label },
      annotator: user?.id || "user",
      confidence: 1.0,
    });
    setStatus("Saved");
  }

  async function runAutoLabel() {
    await apiPost(`/datasets/${datasetId}/versions/${versionId}/auto-label`, {});
    setStatus("Auto labels created");
  }

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to label assets.</div>
      </main>
    );
  }

  return (
    <main className="card">
      <div className="section-title">Labeling</div>
      <button className="btn secondary" onClick={runAutoLabel}>Run Auto Label</button>
      {status && <div style={{ marginTop: 10 }}>{status}</div>}
      <div className="grid" style={{ marginTop: 20 }}>
        {assets.map((a) => (
          <div key={a.id} className="card">
            <div style={{ fontSize: 12, color: "#666" }}>{a.uri}</div>
            {a.media_type.startsWith("image/") && a.uri.startsWith("http") && (
              <img src={a.uri} alt="asset" style={{ width: "100%", marginTop: 8, borderRadius: 10 }} />
            )}
            <label>Label</label>
            <input
              value={labels[a.id] || ""}
              onChange={(e) => setLabels({ ...labels, [a.id]: e.target.value })}
            />
            <button className="btn" onClick={() => saveLabel(a.id)} style={{ marginTop: 8 }}>Save</button>
          </div>
        ))}
      </div>
    </main>
  );
}
