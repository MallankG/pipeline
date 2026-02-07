"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../../../components/api";
import { useSessionUser } from "../../../../../components/session";

type Dataset = {
  id: string;
  name: string;
  data_types: string[];
};

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
};

type Source = {
  id: string;
  source_type: string;
  source_uri: string;
  created_at: string;
};

export default function CuratePage({ params }: { params: { id: string; versionId: string } }) {
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) {
        return;
      }
      const ds = await apiGet(`/datasets/${params.id}`);
      const assetsResult = await apiGet(`/datasets/${params.id}/versions/${params.versionId}/assets`);
      const sourcesResult = await apiGet(`/datasets/${params.id}/versions/${params.versionId}/sources`);
      setDataset(ds);
      setAssets(assetsResult || []);
      setSources(sourcesResult || []);
    }
    load();
  }, [params.id, params.versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to curate datasets.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">Curating: {dataset?.name || "Dataset"}</div>
        <div className="stepper">
          <div className="step">Ingest</div>
          <div className="step">Validate</div>
          <div className="step">Normalize</div>
          <div className="step">Label</div>
        </div>
        <div style={{ marginTop: 12, color: "#6a625a" }}>
          Your pipeline is assembling the dataset. You can review incoming assets while
          validation and normalization are in progress.
        </div>
      </section>

      <section className="card">
        <div className="section-title">Connected Sources</div>
        <div className="grid">
          {sources.length === 0 && <div>No sources connected yet.</div>}
          {sources.map((s) => (
            <div key={s.id} className="stat">
              <strong>{s.source_type}</strong>
              <div>{s.source_uri}</div>
              <div style={{ fontSize: 12, color: "#6a625a" }}>Added {new Date(s.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Curation Activity</div>
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-time">Now</div>
            <div>Parsing metadata and validating schema</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-time">+2 min</div>
            <div>Auto labeling using baseline model hooks</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-time">+5 min</div>
            <div>Generating EDA report and export manifests</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Incoming Assets</div>
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
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <a className="btn secondary" href={`/datasets/${params.id}/eda/${params.versionId}`}>View EDA</a>
          <a className="btn" href={`/datasets/${params.id}/final/${params.versionId}`}>Go to Final Dataset</a>
        </div>
      </section>
    </main>
  );
}
