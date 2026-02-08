"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  id: string;
  name: string;
  description?: string;
  data_types: string[];
};

type Version = {
  id: string;
  version: number;
  status: string;
  created_at: string;
};

type Source = {
  id: string;
  source_type: string;
  source_uri: string;
  created_at: string;
};

export default function DatasetPage() {
  const params = useParams<{ id: string }>();
  const datasetId = params?.id;
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sourcesByVersion, setSourcesByVersion] = useState<Record<string, Source[]>>({});

  useEffect(() => {
    async function load() {
      if (!user || !datasetId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      const vs = await apiGet(`/datasets/${datasetId}/versions`);
      setDataset(ds);
      setVersions(vs || []);

      const sourcesMap: Record<string, Source[]> = {};
      for (const version of vs || []) {
        const src = await apiGet(`/datasets/${datasetId}/versions/${version.id}/sources`);
        sourcesMap[version.id] = src || [];
      }
      setSourcesByVersion(sourcesMap);
    }
    load();
  }, [datasetId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this dataset.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">{dataset?.name || "Dataset"}</div>
        <div style={{ color: "#6a625a" }}>{dataset?.description}</div>
        <div className="badge" style={{ marginTop: 10 }}>{(dataset?.data_types || []).join(", ")}</div>
      </section>

      <section className="card">
        <div className="section-title">Versions</div>
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.version}</td>
                <td>{v.status}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
                <td>
                  <a className="btn secondary" href={`/datasets/${datasetId}/curate/${v.id}`}>Curate</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">Connected Sources</div>
        {versions.length === 0 && <div>No versions yet.</div>}
        {versions.map((v) => (
          <div key={v.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Version v{v.version}</div>
            <div className="grid grid-3">
              {(sourcesByVersion[v.id] || []).map((s) => (
                <div key={s.id} className="stat">
                  <strong>{s.source_type}</strong>
                  <div>{s.source_uri}</div>
                  <div style={{ fontSize: 12, color: "#6a625a" }}>Added {new Date(s.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(sourcesByVersion[v.id] || []).length === 0 && (
                <div className="stat">
                  <strong>No sources</strong>
                  <div>Connect one in the create flow or via Connectors.</div>
                  <div style={{ marginTop: 8 }}>
                    <a className="btn secondary" href="/connectors">Go to Connectors</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
