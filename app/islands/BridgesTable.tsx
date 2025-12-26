import React, { useState } from "react";
import type { Brand } from "../types";
import { BRAND_COLORS, BRAND_NAMES } from "../lib/constants";
import { withBasePath } from "../lib/url";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CooccurrenceCompanionPair {
  idolA: IdolInfo;
  idolB: IdolInfo;
  /** 共起元の数（このペアを同時に随伴しているアイドルの数） */
  cooccurrenceSourceCount: number;
  pmi: number;
  /** 共起元のリスト（このペアを同時に随伴しているアイドル） */
  cooccurrenceSources: IdolInfo[];
}

interface ClusterInfo {
  clusterId: number;
  clusterIndex: number;
}

interface Props {
  bridges: CooccurrenceCompanionPair[];
  /** ペアID（"小さいID|大きいID"形式）からクラスタ情報へのマッピング */
  pairToCluster?: Record<string, ClusterInfo>;
}

function BrandDot({ brand }: { brand: Brand }) {
  return (
    <span
      className="brand-dot"
      style={{ backgroundColor: BRAND_COLORS[brand] }}
      title={BRAND_NAMES[brand]}
    />
  );
}

function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

function ClusterLink({ clusterInfo }: { clusterInfo: ClusterInfo | undefined }) {
  if (!clusterInfo) return <span style={{ color: "#999" }}>-</span>;

  return (
    <a
      href={withBasePath(`/cooccurrence-companion-clusters#cluster-${clusterInfo.clusterIndex}`)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        backgroundColor: "#f0e6f6",
        color: "#8e44ad",
        borderRadius: "4px",
        textDecoration: "none",
        fontSize: "0.85em",
        fontWeight: 500,
      }}
      title={`共起随伴クラスタ #${clusterInfo.clusterIndex + 1} に属する`}
    >
      <span style={{ fontSize: "0.9em" }}>🔗</span>#{clusterInfo.clusterIndex + 1}
    </a>
  );
}

function ExpandedSourcesRow({ sources, colSpan }: { sources: IdolInfo[]; colSpan: number }) {
  return (
    <tr className="expanded-sources-row">
      <td
        colSpan={colSpan}
        style={{
          padding: "12px 16px",
          backgroundColor: "#f8f4fc",
          borderTop: "none",
        }}
      >
        <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
          共起元（このペアを同時に随伴しているアイドル）:
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {sources.map((source) => (
            <a
              key={source.id}
              href={withBasePath(`/idol/${source.id}`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 10px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                textDecoration: "none",
                color: "#333",
                fontSize: "13px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#f0e6f6";
                e.currentTarget.style.borderColor = "#8e44ad";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.borderColor = "#ddd";
              }}
            >
              {source.brand.map((b) => (
                <BrandDot key={b} brand={b} />
              ))}
              {source.name}
            </a>
          ))}
        </div>
      </td>
    </tr>
  );
}

export default function BridgesTable({ bridges, pairToCluster }: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(bridges.map((b) => `${b.idolA.id}-${b.idolB.id}`))
  );
  const hasClusterData = pairToCluster && Object.keys(pairToCluster).length > 0;
  const colSpan = hasClusterData ? 7 : 6;

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = bridges.map((b) => `${b.idolA.id}-${b.idolB.id}`);
    setExpandedKeys(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const allExpanded = expandedKeys.size === bridges.length;
  const noneExpanded = expandedKeys.size === 0;

  return (
    <>
      <p className="bridges-count" style={{ marginBottom: "8px" }}>
        {bridges.length} ペア
      </p>

      <table className="bridges-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドルA</th>
            <th className="arrow">↔</th>
            <th>アイドルB</th>
            <th className="voter-count">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>共起元</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={expandAll}
                    disabled={allExpanded}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      cursor: allExpanded ? "default" : "pointer",
                      backgroundColor: allExpanded ? "#e0e0e0" : "#f0e6f6",
                      border: `1px solid ${allExpanded ? "#ccc" : "#8e44ad"}`,
                      borderRadius: "3px",
                      color: allExpanded ? "#999" : "#8e44ad",
                    }}
                    title="全て開く"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    disabled={noneExpanded}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      cursor: noneExpanded ? "default" : "pointer",
                      backgroundColor: noneExpanded ? "#e0e0e0" : "#fff",
                      border: `1px solid ${noneExpanded ? "#ccc" : "#999"}`,
                      borderRadius: "3px",
                      color: noneExpanded ? "#ccc" : "#666",
                    }}
                    title="全て閉じる"
                  >
                    ▲
                  </button>
                </div>
              </div>
            </th>
            <th className="pmi-value">PMI</th>
            {hasClusterData && <th className="cluster-link">クラスタ</th>}
          </tr>
        </thead>
        <tbody>
          {bridges.map((bridge, index) => {
            const pairKey = makePairKey(bridge.idolA.id, bridge.idolB.id);
            const clusterInfo = pairToCluster?.[pairKey];
            const rowKey = `${bridge.idolA.id}-${bridge.idolB.id}`;
            const isExpanded = expandedKeys.has(rowKey);

            return (
              <React.Fragment key={rowKey}>
                <tr
                  className={`bridge-row ${isExpanded ? "expanded" : ""}`}
                  style={{
                    backgroundColor: isExpanded ? "#f0e6f6" : clusterInfo ? "#faf5fc" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(rowKey)}
                >
                  <td className="rank">{index + 1}</td>
                  <td>
                    <a
                      href={withBasePath(`/idol/${bridge.idolA.id}`)}
                      className="idol-name clickable"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {bridge.idolA.brand.map((b) => (
                        <BrandDot key={b} brand={b} />
                      ))}
                      {bridge.idolA.name}
                    </a>
                  </td>
                  <td className="arrow">↔</td>
                  <td>
                    <a
                      href={withBasePath(`/idol/${bridge.idolB.id}`)}
                      className="idol-name clickable"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {bridge.idolB.brand.map((b) => (
                        <BrandDot key={b} brand={b} />
                      ))}
                      {bridge.idolB.name}
                    </a>
                  </td>
                  <td className="voter-count">
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#8e44ad",
                        fontWeight: 500,
                        fontSize: "0.9em",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: "16px",
                          textAlign: "center",
                          transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        ▶
                      </span>
                      {bridge.cooccurrenceSources.length}人
                    </span>
                  </td>
                  <td className="pmi-value">{bridge.pmi.toFixed(2)}</td>
                  {hasClusterData && (
                    <td className="cluster-link" onClick={(e) => e.stopPropagation()}>
                      <ClusterLink clusterInfo={clusterInfo} />
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <ExpandedSourcesRow
                    key={`${rowKey}-expanded`}
                    sources={bridge.cooccurrenceSources}
                    colSpan={colSpan}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
