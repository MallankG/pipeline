"use client";

import React from "react";

/** Animated skeleton shimmer block */
function Shimmer({ width = "100%", height = 18, radius = 10, style }: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, rgba(29,26,23,0.06) 25%, rgba(29,26,23,0.12) 50%, rgba(29,26,23,0.06) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Full-page skeleton that matches the approximate layout of most app pages */
export default function PageLoader({ lines = 3 }: { lines?: number }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <main className="grid fade-up" style={{ gap: 24, opacity: 0.7 }}>
        {/* Title card */}
        <section className="card">
          <Shimmer width="42%" height={36} radius={14} />
          <Shimmer width="70%" height={14} radius={8} style={{ marginTop: 14 }} />
        </section>

        {/* Content cards */}
        {Array.from({ length: lines }).map((_, i) => (
          <section key={i} className="card" style={{ display: "grid", gap: 14 }}>
            <Shimmer width="28%" height={20} radius={10} />
            <Shimmer width="100%" height={14} />
            <Shimmer width="85%" height={14} />
            <Shimmer width="60%" height={14} />
          </section>
        ))}
      </main>
    </>
  );
}
