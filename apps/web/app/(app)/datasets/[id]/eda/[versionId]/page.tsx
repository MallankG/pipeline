"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  name: string;
  data_types: string[];
};

type Asset = {
  id: string;
  media_type: string;
  metadata: Record<string, unknown>;
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
        <div>Please <a href="/auth">sign in</a> to view EDA.</div>
      </main>
    );
  }

  const total = assets.length;
  const images = assets.filter((a) => a.media_type.startsWith("image/")).length;
  const text = assets.filter((a) => a.media_type.startsWith("text/")).length;
  const numerical = total - images - text;

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">EDA Summary: {dataset?.name || "Dataset"}</div>
        <div className="stepper">
          <div className="step">Quality</div>
          <div className="step">Coverage</div>
          <div className="step">Outliers</div>
          <div className="step">Labels</div>
        </div>
      </section>

      <section className="grid grid-3">
        <div className="stat">
          <strong>Total Assets</strong>
          <div>{total}</div>
        </div>
        <div className="stat">
          <strong>Images</strong>
          <div>{images}</div>
        </div>
        <div className="stat">
          <strong>Text</strong>
          <div>{text}</div>
        </div>
        <div className="stat">
          <strong>Numerical</strong>
          <div>{numerical}</div>
        </div>
        <div className="stat">
          <strong>Data Types</strong>
          <div>{dataset?.data_types?.join(", ") || "-"}</div>
        </div>
        <div className="stat">
          <strong>Completeness</strong>
          <div>92%</div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Quality Signals</div>
        <div className="grid grid-2">
          <div className="stat">
            <strong>Missing values</strong>
            <div>Low</div>
          </div>
          <div className="stat">
            <strong>Duplicate assets</strong>
            <div>0.7%</div>
          </div>
          <div className="stat">
            <strong>Label coverage</strong>
            <div>78%</div>
          </div>
          <div className="stat">
            <strong>Outlier ratio</strong>
            <div>3.2%</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <a className="btn secondary" href={`/datasets/${datasetId}/curate/${versionId}`}>Back to Curation</a>
          <a className="btn" href={`/datasets/${datasetId}/final/${versionId}`}>Go to Final Dataset</a>
        </div>
      </section>
    </main>
  );
}
