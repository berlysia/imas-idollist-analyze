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

function CooccurrenceSourceList({ sources }: { sources: IdolInfo[] }) {
  if (sources.length === 0) return null;

  return (
    <details className="cooccurrence-sources-details">
      <summary
        style={{
          cursor: "pointer",
          color: "#8e44ad",
          fontWeight: 500,
          fontSize: "0.9em",
        }}
      >
        {sources.length}人が同時選出
      </summary>
      <ul
        style={{
          margin: "8px 0 0 0",
          padding: "8px 0 8px 16px",
          listStyle: "none",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
          fontSize: "0.85em",
          backgroundColor: "#f8f4fc",
          borderRadius: "4px",
        }}
      >
        {sources.map((source) => (
          <li key={source.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {source.brand.map((b) => (
              <BrandDot key={b} brand={b} />
            ))}
            <a
              href={`/idol/${source.id}`}
              style={{ color: "#333", textDecoration: "none" }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {source.name}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function BridgesTable({ bridges, pairToCluster }: Props) {
  const hasClusterData = pairToCluster && Object.keys(pairToCluster).length > 0;

  return (
    <>
      <p className="bridges-count">{bridges.length} ペア</p>

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

            return (
              <tr
                key={`${bridge.idolA.id}-${bridge.idolB.id}`}
                className="bridge-row"
                style={clusterInfo ? { backgroundColor: "#faf5fc" } : undefined}
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
                  >
                    {bridge.idolB.brand.map((b) => (
                      <BrandDot key={b} brand={b} />
                    ))}
                    {bridge.idolB.name}
                  </a>
                </td>
                <td className="voter-count">
                  <CooccurrenceSourceList sources={bridge.cooccurrenceSources} />
                </td>
                <td className="pmi-value">{bridge.pmi.toFixed(2)}</td>
                {hasClusterData && (
                  <td className="cluster-link">
                    <ClusterLink clusterInfo={clusterInfo} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
