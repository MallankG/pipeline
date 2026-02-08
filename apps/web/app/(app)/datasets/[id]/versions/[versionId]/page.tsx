"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import VersionActions from "@/components/VersionActions";

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  created_at: string;
};

export default function VersionPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      try {
        const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
        const jobsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`);
        setAssets(assetsResult || []);
        setJobs(jobsResult || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load version data");
      }
    }
    load();
  }, [datasetId, versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this version.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 24 }}>
      {error && <section className="card" style={{ color: "#b60000" }}>{error}</section>}

      {datasetId && versionId && (
        <VersionActions datasetId={datasetId} versionId={versionId} />
      )}

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

      <section className="card">
        <div className="section-title">Jobs</div>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.type}</td>
                <td>{j.status}</td>
                <td>{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">Labeling</div>
        <a className="btn secondary" href={`/label/${datasetId}/${versionId}`}>Open Labeling UI</a>
      </section>
    </main>
  );
}
