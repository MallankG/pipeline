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
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="page-title">EDA: {dataset?.name || "Dataset"}</div>
        <div className="muted">Version {versionId}</div>
      </section>

      <section className="card">
        <div className="section-title">Summary</div>
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
        <div className="section-title">Next actions</div>
        <div className="inline-actions">
          <a className="btn secondary" href={`/datasets/${datasetId}/curate/${versionId}`}>Back to Curation</a>
          <a className="btn" href={`/datasets/${datasetId}/final/${versionId}`}>Go to Final Dataset</a>
        </div>
      </section>
    </main>
  );
}
