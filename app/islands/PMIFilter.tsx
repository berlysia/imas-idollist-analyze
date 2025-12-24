import { useState, useMemo } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES } from "../lib/constants";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface PairCooccurrence {
  idolA: IdolInfo;
  idolB: IdolInfo;
  count: number;
  pmi: number;
  crossBrand: boolean;
}

interface ClusterInfo {
  clusterId: number;
  clusterIndex: number;
}

interface Props {
  pairs: PairCooccurrence[];
  /** ペアID（"小さいID|大きいID"形式）から随伴クラスタ情報へのマッピング */
  pairToCluster?: Record<string, ClusterInfo>;
  /** ペアID（"小さいID|大きいID"形式）から共起随伴クラスタ情報へのマッピング */
  crossBrandPairToCluster?: Record<string, ClusterInfo>;
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

function ClusterLink({
  clusterInfo,
  crossBrandClusterInfo,
}: {
  clusterInfo: ClusterInfo | undefined;
  crossBrandClusterInfo: ClusterInfo | undefined;
}) {
  if (!clusterInfo && !crossBrandClusterInfo) return <span style={{ color: "#999" }}>-</span>;

  return (
    <span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {clusterInfo && (
        <a
          href={`/accompaniment-clusters#cluster-${clusterInfo.clusterIndex}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            backgroundColor: "#e3f2fd",
            color: "#1976d2",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.85em",
            fontWeight: 500,
          }}
          title={`随伴クラスタ #${clusterInfo.clusterIndex + 1} に属する`}
        >
          <span style={{ fontSize: "0.9em" }}>🔗</span>#{clusterInfo.clusterIndex + 1}
        </a>
      )}
      {crossBrandClusterInfo && (
        <a
          href={`/cooccurrence-companion-clusters#cluster-${crossBrandClusterInfo.clusterIndex}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            backgroundColor: "#fff3e0",
            color: "#e65100",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.85em",
            fontWeight: 500,
          }}
          title={`共起随伴クラスタ #${crossBrandClusterInfo.clusterIndex + 1} に属する`}
        >
          <span style={{ fontSize: "0.9em" }}>🌐</span>#{crossBrandClusterInfo.clusterIndex + 1}
        </a>
      )}
    </span>
  );
}

export default function PMIFilter({ pairs, pairToCluster, crossBrandPairToCluster }: Props) {
  const [crossBrandOnly, setCrossBrandOnly] = useState(false);
  const hasClusterData =
    (pairToCluster && Object.keys(pairToCluster).length > 0) ||
    (crossBrandPairToCluster && Object.keys(crossBrandPairToCluster).length > 0);

  const filteredPairs = useMemo(() => {
    if (crossBrandOnly) {
      return pairs.filter((p) => p.crossBrand);
    }
    return pairs;
  }, [pairs, crossBrandOnly]);

  const handleCrossBrandChange = (checked: boolean) => {
    setCrossBrandOnly(checked);
  };

  return (
    <>
      <section className="filters" style={{ marginBottom: "16px" }}>
        <label className="brand-checkbox" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={crossBrandOnly}
            onChange={(e) => handleCrossBrandChange(e.target.checked)}
          />
          異種ブランドペアのみ表示
        </label>
      </section>

      <p className="pmi-count">
        {filteredPairs.length} ペア
        {crossBrandOnly && ` (横断のみ: ${pairs.filter((p) => p.crossBrand).length})`}
      </p>

      <table className="pmi-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドルA</th>
            <th className="arrow">↔</th>
            <th>アイドルB</th>
            <th className="count">掲載数</th>
            <th className="pmi-value">PMI</th>
            <th className="cross-brand-indicator">横断</th>
            {hasClusterData && <th className="cluster-link">クラスタ</th>}
          </tr>
        </thead>
        <tbody>
          {filteredPairs.map((pair, index) => {
            const pairKey = makePairKey(pair.idolA.id, pair.idolB.id);
            const clusterInfo = pairToCluster?.[pairKey];
            const crossBrandClusterInfo = crossBrandPairToCluster?.[pairKey];
            const hasAnyCluster = clusterInfo || crossBrandClusterInfo;

            return (
              <tr
                key={`${pair.idolA.id}-${pair.idolB.id}`}
                className={pair.crossBrand ? "cross-brand" : ""}
                style={hasAnyCluster ? { backgroundColor: "#f5faff" } : undefined}
              >
                <td className="rank">{index + 1}</td>
                <td>
                  <a
                    href={`/idol/${pair.idolA.id}`}
                    className="idol-name clickable"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    {pair.idolA.brand.map((b) => (
                      <BrandDot key={b} brand={b} />
                    ))}
                    {pair.idolA.name}
                  </a>
                </td>
                <td className="arrow">↔</td>
                <td>
                  <a
                    href={`/idol/${pair.idolB.id}`}
                    className="idol-name clickable"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    {pair.idolB.brand.map((b) => (
                      <BrandDot key={b} brand={b} />
                    ))}
                    {pair.idolB.name}
                  </a>
                </td>
                <td className="count">{pair.count}</td>
                <td className="pmi-value">{pair.pmi.toFixed(2)}</td>
                <td className="cross-brand-indicator">{pair.crossBrand ? "✓" : ""}</td>
                {hasClusterData && (
                  <td className="cluster-link">
                    <ClusterLink
                      clusterInfo={clusterInfo}
                      crossBrandClusterInfo={crossBrandClusterInfo}
                    />
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
