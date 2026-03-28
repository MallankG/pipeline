"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import PageLoader from "@/components/PageLoader";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { Hash, Type, Table, Rows, Columns, AlertCircle } from "lucide-react";

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
  metadata?: any;
};

type Dataset = { id: string; name: string };

function FeatureCardNumerical({ name, data }: { name: string; data: any }) {
  const chartData = [
    { name: "Min", value: data["min"] ?? 0 },
    { name: "25%", value: data["25%"] ?? 0 },
    { name: "Median", value: data["50%"] ?? 0 },
    { name: "75%", value: data["75%"] ?? 0 },
    { name: "Max", value: data["max"] ?? 0 }
  ];

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ padding: 8, background: "rgba(34,197,94,0.1)", color: "var(--ok, #22c55e)", borderRadius: 8 }}>
          <Hash size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{name}</h3>
          <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Numerical Continuous
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.85rem", background: "rgba(29,26,23,0.03)", padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}>
        <div><span className="muted">Mean</span> <div style={{ fontWeight: 600, fontSize: "1rem" }}>{typeof data.mean === "number" ? data.mean.toFixed(2) : data.mean}</div></div>
        <div><span className="muted">Std Dev</span> <div style={{ fontWeight: 600, fontSize: "1rem" }}>{typeof data.std === "number" ? data.std.toFixed(2) : data.std}</div></div>
      </div>

      <div style={{ height: 160, marginTop: 8, flexGrow: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "0.85rem" }}
              itemStyle={{ color: "var(--ink)" }}
            />
            <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FeatureCardCategorical({ name, data }: { name: string; data: any }) {
  const topFreq = Number(data.freq) || 0;
  const totalCount = Number(data.count) || 1;
  const otherFreq = totalCount - topFreq;

  const chartData = [
    { name: data.top || "Top", count: topFreq, color: "var(--accent-strong)" },
    { name: "Others", count: otherFreq, color: "var(--line)" }
  ];

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ padding: 8, background: "rgba(217,119,6,0.1)", color: "#d97706", borderRadius: 8 }}>
          <Type size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{name}</h3>
          <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Categorical
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.85rem", background: "rgba(29,26,23,0.03)", padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}>
        <div><span className="muted">Unique Values</span> <div style={{ fontWeight: 600, fontSize: "1rem" }}>{data.unique}</div></div>
        <div><span className="muted">Top Value</span> <div style={{ fontWeight: 600, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.top || "N/A"}</div></div>
      </div>

      <div style={{ height: 160, marginTop: 8, flexGrow: 1 }}>
         <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--ink)", width: 80 }} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", fontSize: "0.85rem" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function EdaPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading: authLoading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versionNum, setVersionNum] = useState<number | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !datasetId || !versionId) return;
    Promise.all([
      apiGet(`/datasets/${datasetId}`),
      apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`),
      apiGet(`/datasets/${datasetId}/versions`),
    ])
      .then(([ds, assetsResult, versionsResult]) => {
        setDataset(ds);
        setAssets(assetsResult || []);
        const v = (versionsResult || []).find((v: any) => v.id === versionId);
        if (v) setVersionNum(v.version);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load EDA data");
        setAssets([]);
      });
  }, [datasetId, versionId, user]);

  if (authLoading) return <PageLoader />;
  if (!user) return <main className="card"><div>Please <a href="/auth">sign in</a> to access EDA.</div></main>;
  if (!dataset || assets === null) return <PageLoader />;

  // Find the first numerical / parsed asset for deeper EDA display
  const primaryDataAsset = assets.find(a => 
    a.metadata?.summary && Object.keys(a.metadata.summary).length > 0
  );
  
  const hasWarning = primaryDataAsset?.metadata?.warning;

  return (
    <main className="grid fade-up" style={{ gap: 24 }}>
      {error && <div className="alert warn">{error}</div>}

      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ paddingBottom: 8 }}>
          <h1 className="page-title" style={{ margin: 0, paddingBottom: 8, lineHeight: 1.1 }}>Exploratory Data Analysis</h1>
          <div className="muted" style={{ marginTop: 8, fontSize: "0.95rem" }}>
            Dataset: <strong>{dataset.name}</strong> • Version: <strong>{versionNum !== null ? `v${versionNum}` : versionId}</strong>
          </div>
        </div>
        <div className="inline-actions">
           <a className="btn secondary" href={`/datasets/${datasetId}/curate/${versionId}`}>Back to Curation</a>
           <a className="btn secondary" href={`/datasets/${datasetId}/query`}>Query Dataset</a>
        </div>
      </section>

      {hasWarning ? (
        <section className="card" style={{ background: "rgba(239,68,68,0.03)", borderColor: "rgba(239,68,68,0.2)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AlertCircle color="#ef4444" size={24} style={{ marginTop: 4 }} />
            <div>
              <h3 style={{ margin: "0 0 6px 0", color: "#ef4444" }}>Partial Processing Warning</h3>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.5 }}>
                The backend encountered an issue during processing: <strong>{hasWarning}</strong>. 
                Full mathematical statistics could not be generated for this asset.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Primary Asset Overview Widget */}
      {primaryDataAsset && !hasWarning && (
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", background: "rgba(29,26,23,0.03)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
            <Table size={20} color="var(--muted)" />
            <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>
              {decodeURIComponent(primaryDataAsset.uri.split('/').pop() || primaryDataAsset.uri)}
            </span>
            <div className="chip">{primaryDataAsset.metadata?.source_type || "File"}</div>
          </div>
          <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ padding: 12, background: "rgba(29,26,23,0.05)", borderRadius: 12 }}><Rows size={24} color="var(--ink)" /></div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{primaryDataAsset.metadata?.rows?.toLocaleString() ?? "-"}</div>
                <div className="muted" style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>Total Rows (Records)</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ padding: 12, background: "rgba(29,26,23,0.05)", borderRadius: 12 }}><Columns size={24} color="var(--ink)" /></div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{primaryDataAsset.metadata?.cols?.toLocaleString() ?? "-"}</div>
                <div className="muted" style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>Total Features</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Feature Visualizer */}
      {primaryDataAsset && primaryDataAsset.metadata?.summary && !hasWarning && (
        <section>
          <div className="section-title" style={{ marginBottom: 16 }}>Feature Distributions</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
             {Object.entries(primaryDataAsset.metadata.summary).map(([key, data]: [string, any]) => {
                // If the dataset contains categorical "unique" keys
                if ("unique" in data && data.unique !== "") {
                  return <FeatureCardCategorical key={key} name={key} data={data} />;
                }
                // Otherwise it's numerical continuous
                return <FeatureCardNumerical key={key} name={key} data={data} />;
             })}
          </div>
        </section>
      )}

      {/* Fallback layout for assets with NO tabular data available */}
      {(!primaryDataAsset || hasWarning) && assets.length > 0 && (
         <section className="card">
            <div className="section-title">Raw Asset Metadata List</div>
            <table className="table" style={{ marginTop: 16 }}>
              <thead><tr><th>URI</th><th>Type</th><th>Metadata</th></tr></thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td>{decodeURIComponent(a.uri.split('/').pop() || a.uri)}</td>
                    <td><span className="chip">{a.media_type}</span></td>
                    <td><pre style={{ fontSize: 10, margin: 0, opacity: 0.8 }}>{JSON.stringify(a.metadata || {}, null, 2)}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
         </section>
      )}
    </main>
  );
}
