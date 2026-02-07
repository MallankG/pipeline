"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../../../components/api";
import { useSessionUser } from "../../../../../components/session";

type Dataset = {
  name: string;
};

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
};

export default function FinalPage({ params }: { params: { id: string; versionId: string } }) {
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) {
        return;
      }
      const ds = await apiGet(`/datasets/${params.id}`);
      const assetsResult = await apiGet(`/datasets/${params.id}/versions/${params.versionId}/assets`);
      setDataset(ds);
      setAssets(assetsResult || []);
    }
    load();
  }, [params.id, params.versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to view the final dataset.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">Final Dataset: {dataset?.name || "Dataset"}</div>
        <div className="badge">Version {params.versionId}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <a className="btn secondary" href={`/datasets/${params.id}/eda/${params.versionId}`}>View EDA</a>
          <a className="btn" href={`/datasets/${params.id}/curate/${params.versionId}`}>Back to Curation</a>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Exports</div>
        <div className="grid grid-2">
          <div className="stat">
            <strong>Manifest</strong>
            <div>processed/datasets/{params.id}/versions/{params.versionId}/manifest.jsonl</div>
          </div>
          <div className="stat">
            <strong>Image Export</strong>
            <div>COCO / YOLO (configured)</div>
          </div>
          <div className="stat">
            <strong>Text Export</strong>
            <div>JSONL + HF Dataset</div>
          </div>
          <div className="stat">
            <strong>Numerical Export</strong>
            <div>Parquet</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Assets</div>
        <table className="table">
          <thead>
            <tr>
              <th>URI</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.uri}</td>
                <td>{a.media_type}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
