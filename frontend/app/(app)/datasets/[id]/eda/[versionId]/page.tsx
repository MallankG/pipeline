"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  media_type: string;
  status: string;
};

export default function EdaPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      setDataset(ds);
      setAssets(assetsResult || []);
    }
    load();
  }, [datasetId, versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access EDA.</div>
      </main>
    );
  }

  const total = assets.length;
  const byType = assets.reduce<Record<string, number>>((acc, a) => {
    const key = a.media_type.split("/")[0] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="page-title">EDA: {dataset?.name || "Dataset"}</div>
        <div className="muted">Version {versionId}</div>
      </section>

      <section className="card">
        <div className="section-title">Record Distribution</div>
        <div className="grid grid-3">
          <div className="stat"><strong>Total assets</strong><div>{total}</div></div>
          {Object.entries(byType).map(([key, value]) => (
            <div key={key} className="stat">
              <strong>{key}</strong>
              <div>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Feature Metadata (Sample)</div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>URI</th>
                <th>Type</th>
                <th>Summary Stats</th>
              </tr>
            </thead>
            <tbody>
              {assets.slice(0, 10).map((a: any) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12 }}>{a.uri.split('/').pop()}</td>
                  <td><span className="chip">{a.media_type}</span></td>
                  <td>
                    <pre style={{ fontSize: 10, margin: 0, opacity: 0.8 }}>
                      {JSON.stringify(a.metadata || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assets.length > 10 && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Showing first 10 assets.</div>}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Next actions</div>
        <div className="inline-actions">
          <a className="btn secondary" href={`/datasets/${datasetId}/curate/${versionId}`}>Back to Curation</a>
          <a className="btn" href={`/datasets/${datasetId}/final/${versionId}`}>Go to Final Dataset</a>
        </div>
      </section>
    </main>
  );
}
