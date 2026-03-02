"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  id: string;
  name: string;
};

export default function FinalPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      setDataset(ds);
    }
    load();
  }, [datasetId, versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access final datasets.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="page-title">Final Dataset: {dataset?.name || "Dataset"}</div>
        <div className="badge">Version {versionId}</div>
        <div style={{ marginTop: 12 }} className="inline-actions">
          <a className="btn secondary" href={`/datasets/${datasetId}/eda/${versionId}`}>View EDA</a>
          <a className="btn" href={`/datasets/${datasetId}/curate/${versionId}`}>Back to Curation</a>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Exports</div>
        <div className="grid grid-2">
          <div className="stat">
            <strong>Manifest</strong>
            <div>processed/datasets/{datasetId}/versions/{versionId}/manifest.jsonl</div>
          </div>
          <div className="stat">
            <strong>Image Export</strong>
            <div>processed/datasets/{datasetId}/versions/{versionId}/images.zip</div>
          </div>
          <div className="stat">
            <strong>Text Export</strong>
            <div>processed/datasets/{datasetId}/versions/{versionId}/text.jsonl</div>
          </div>
          <div className="stat">
            <strong>Tabular Export</strong>
            <div>processed/datasets/{datasetId}/versions/{versionId}/data.parquet</div>
          </div>
        </div>
      </section>
    </main>
  );
}
