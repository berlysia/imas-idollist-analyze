import React, { useState } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES } from "../lib/constants";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CrossBrandBridge {
  idolA: IdolInfo;
  idolB: IdolInfo;
  /** 共起元の数（このペアを同時に掲載しているアイドルの数） */
  cooccurrenceSourceCount: number;
  pmi: number;
  /** 共起元のリスト（このペアを同時に掲載しているアイドル） */
  cooccurrenceSources: IdolInfo[];
}

interface ClusterInfo {
  clusterId: number;
  clusterIndex: number;
}

interface Props {
  bridges: CrossBrandBridge[];
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
      href={`/cross-brand-clusters#cluster-${clusterInfo.clusterIndex}`}
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
      title={`ブランド横断クラスタ #${clusterInfo.clusterIndex + 1} に属する`}
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
          共起元（このペアを同時に掲載しているアイドル）:
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
              href={`/idol/${source.id}`}
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
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

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <p className="bridges-count" style={{ margin: 0 }}>
          {bridges.length} ペア
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={expandAll}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              cursor: "pointer",
              backgroundColor: "#f0e6f6",
              border: "1px solid #8e44ad",
              borderRadius: "4px",
              color: "#8e44ad",
            }}
          >
            全て開く
          </button>
          <button
            type="button"
            onClick={collapseAll}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              cursor: "pointer",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              color: "#666",
            }}
          >
            全て閉じる
          </button>
        </div>
      </div>

      <table className="bridges-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドルA</th>
            <th className="arrow">↔</th>
            <th>アイドルB</th>
            <th className="voter-count">共起元</th>
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
                      href={`/idol/${bridge.idolA.id}`}
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
                      href={`/idol/${bridge.idolB.id}`}
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
