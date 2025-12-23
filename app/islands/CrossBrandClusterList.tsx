import { useState, useMemo } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES, ALL_BRANDS } from "../lib/constants";
import CrossBrandClusterGraph from "./CrossBrandClusterGraph";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CrossBrandEdge {
  idolA: IdolInfo;
  idolB: IdolInfo;
  voterCount: number;
  pmi: number;
  voters: IdolInfo[];
}

interface CrossBrandCluster {
  id: number;
  members: string[];
  memberDetails: IdolInfo[];
  edges: CrossBrandEdge[];
  totalVoterCount: number;
  avgPmi: number;
  brands: Brand[];
  brandCount: number;
}

interface Props {
  clusters: CrossBrandCluster[];
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

function MemberTag({
  member,
  isHidden,
  onToggleHide,
}: {
  member: IdolInfo;
  isHidden: boolean;
  onToggleHide: (id: string) => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
      }}
    >
      <input
        type="checkbox"
        checked={!isHidden}
        onChange={() => onToggleHide(member.id)}
        title={isHidden ? "グラフに表示" : "グラフから非表示"}
        style={{ cursor: "pointer", margin: 0 }}
      />
      <a
        href={`/idol/${member.id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          background: isHidden ? "#eee" : "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: "4px",
          textDecoration: "none",
          color: "inherit",
          fontSize: "14px",
          opacity: isHidden ? 0.5 : 1,
        }}
      >
        {member.brand.map((b) => (
          <BrandDot key={b} brand={b} />
        ))}
        <span style={{ textDecoration: isHidden ? "line-through" : "none" }}>{member.name}</span>
      </a>
    </span>
  );
}

function EdgeVotersList({ edges }: { edges: CrossBrandEdge[] }) {
  const [expandedEdge, setExpandedEdge] = useState<string | null>(null);

  // PMI順でソート
  const sortedEdges = useMemo(() => [...edges].sort((a, b) => b.pmi - a.pmi), [edges]);

  return (
    <div style={{ marginTop: "12px" }}>
      <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
        ブランド横断ペア詳細（クリックで選出者を表示）
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {sortedEdges.map((edge) => {
          const edgeKey = `${edge.idolA.id}-${edge.idolB.id}`;
          const isExpanded = expandedEdge === edgeKey;

          return (
            <div
              key={edgeKey}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                background: isExpanded ? "#f9f0ff" : "#fafafa",
              }}
            >
              <button
                onClick={() => setExpandedEdge(isExpanded ? null : edgeKey)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#8e44ad" }}>{isExpanded ? "▼" : "▶"}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {edge.idolA.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  <a
                    href={`/idol/${edge.idolA.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {edge.idolA.name}
                  </a>
                </span>
                <span style={{ color: "#999" }}>×</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {edge.idolB.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  <a
                    href={`/idol/${edge.idolB.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {edge.idolB.name}
                  </a>
                </span>
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#666" }}>
                  {edge.voterCount}人が選出 / PMI: {edge.pmi.toFixed(2)}
                </span>
              </button>

              {isExpanded && (
                <div
                  style={{
                    padding: "8px 12px 12px 28px",
                    borderTop: "1px solid #e0e0e0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                    このペアを同時に共起として選出したアイドル:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {edge.voters.map((voter) => (
                      <a
                        key={voter.id}
                        href={`/idol/${voter.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 8px",
                          background: "#f5f5f5",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          textDecoration: "none",
                          color: "inherit",
                          fontSize: "13px",
                        }}
                      >
                        {voter.brand.map((b) => (
                          <BrandDot key={b} brand={b} />
                        ))}
                        {voter.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClusterCard({ cluster, rank }: { cluster: CrossBrandCluster; rank: number }) {
  const [showGraph, setShowGraph] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const toggleHide = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const brandCounts = useMemo(() => {
    const counts = new Map<Brand, number>();
    for (const member of cluster.memberDetails) {
      for (const brand of member.brand) {
        counts.set(brand, (counts.get(brand) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [cluster.memberDetails]);

  return (
    <div
      className="cluster-card"
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              background: "#8e44ad",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            #{rank}
          </span>
          {cluster.memberDetails.length}人 / {cluster.brandCount}ブランド
        </h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "#666" }}>
            投票者: {cluster.totalVoterCount}人
          </span>
          <span style={{ fontSize: "12px", color: "#8e44ad" }}>
            平均PMI: {cluster.avgPmi.toFixed(2)}
          </span>
          <span style={{ fontSize: "12px", color: "#666" }}>エッジ: {cluster.edges.length}本</span>
          <button
            onClick={() => setShowGraph(!showGraph)}
            style={{
              padding: "4px 8px",
              background: showGraph ? "#8e44ad" : "#e0e0e0",
              color: showGraph ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            {showGraph ? "グラフを隠す" : "グラフ表示"}
          </button>
        </div>
      </div>

      {showGraph && (
        <div style={{ marginBottom: "16px" }}>
          <CrossBrandClusterGraph
            cluster={cluster}
            width={700}
            height={500}
            hiddenIds={hiddenIds}
          />
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        {brandCounts.map(([brand, count]) => (
          <span
            key={brand}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              marginRight: "12px",
              fontSize: "12px",
            }}
          >
            <BrandDot brand={brand} />
            {BRAND_NAMES[brand]}: {count}人
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {cluster.memberDetails.map((member) => (
          <MemberTag
            key={member.id}
            member={member}
            isHidden={hiddenIds.has(member.id)}
            onToggleHide={toggleHide}
          />
        ))}
      </div>

      <details style={{ marginTop: "12px" }}>
        <summary
          style={{
            cursor: "pointer",
            fontSize: "14px",
            color: "#666",
            padding: "8px 0",
          }}
        >
          ペア詳細を表示（{cluster.edges.length}件）
        </summary>
        <EdgeVotersList edges={cluster.edges} />
      </details>
    </div>
  );
}

export default function CrossBrandClusterList({ clusters }: Props) {
  const [brandFilter, setBrandFilter] = useState<Brand | null>(null);
  const [minSize, setMinSize] = useState(3);

  const filteredClusters = useMemo(() => {
    return clusters.filter((cluster) => {
      if (cluster.memberDetails.length < minSize) return false;
      if (brandFilter) {
        return cluster.brands.includes(brandFilter);
      }
      return true;
    });
  }, [clusters, brandFilter, minSize]);

  const stats = useMemo(() => {
    const totalMembers = new Set(clusters.flatMap((c) => c.members)).size;
    const avgSize =
      clusters.length > 0
        ? clusters.reduce((sum, c) => sum + c.memberDetails.length, 0) / clusters.length
        : 0;
    const avgBrands =
      clusters.length > 0
        ? clusters.reduce((sum, c) => sum + c.brandCount, 0) / clusters.length
        : 0;
    return { totalMembers, avgSize, avgBrands };
  }, [clusters]);

  return (
    <div className="cluster-list">
      <div className="cluster-explanation" style={{ marginBottom: "16px" }}>
        <p>
          <strong>ブランド横断クラスタ</strong>
          は、異なるブランドのアイドル同士が共起として選ばれているグループです。
        </p>
        <p>
          ブランド横断ペア（異なるブランドのアイドルが同時に共起に選ばれている）のみを
          エッジとしてLouvain法でコミュニティ検出を行っています。
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "16px",
          padding: "12px",
          background: "#f9f9f9",
          borderRadius: "8px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>全体統計:</strong> {clusters.length}クラスタ / {stats.totalMembers}人
        </div>
        <div>平均サイズ: {stats.avgSize.toFixed(1)}人</div>
        <div>平均ブランド数: {stats.avgBrands.toFixed(1)}</div>
      </div>

      <div
        className="filters"
        style={{ marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          ブランド:
          <select
            value={brandFilter ?? ""}
            onChange={(e) => setBrandFilter((e.target.value as Brand) || null)}
            style={{ padding: "4px 8px" }}
          >
            <option value="">すべて</option>
            {ALL_BRANDS.map((brand) => (
              <option key={brand} value={brand}>
                {BRAND_NAMES[brand]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          最小人数:
          <input
            type="number"
            min={3}
            max={20}
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value))}
            style={{ width: "60px", padding: "4px 8px" }}
          />
        </label>
      </div>

      <p style={{ marginBottom: "16px", color: "#666" }}>
        {filteredClusters.length} クラスタを表示中
      </p>

      {filteredClusters.map((cluster, index) => (
        <ClusterCard key={cluster.id} cluster={cluster} rank={index + 1} />
      ))}

      {filteredClusters.length === 0 && (
        <p style={{ textAlign: "center", color: "#999", padding: "32px" }}>
          条件に一致するクラスタがありません
        </p>
      )}
    </div>
  );
}
