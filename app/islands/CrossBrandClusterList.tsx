import { useState, useMemo } from "react";
import type { Brand } from "@/types";
import { BRAND_NAMES, ALL_BRANDS } from "../lib/constants";
import CrossBrandClusterGraph from "./CrossBrandClusterGraph";
import {
  BrandDot,
  RankBadge,
  ClusterStats,
  FilterContainer,
  ExplanationBox,
  ClusterCardContainer,
  ClusterCardHeader,
  BrandBreakdown,
  MemberTagList,
  EmptyMessage,
  StatLabel,
  GraphSection,
} from "../components/shared";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CrossBrandClusterMember {
  id: string;
  name: string;
  brand: Brand[];
  coreness: number;
  degree: number;
  pmiWeightedDegree: number;
  voterWeightedDegree: number;
  role: "core" | "peripheral";
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
  memberRoles: CrossBrandClusterMember[];
  coreMembers: string[];
  peripheralMembers: string[];
  coreDensity: number;
  edges: CrossBrandEdge[];
  totalVoterCount: number;
  avgPmi: number;
  brands: Brand[];
  brandCount: number;
}

interface Props {
  clusters: CrossBrandCluster[];
}

function MemberTag({
  member,
  isHidden,
  onToggleHide,
}: {
  member: CrossBrandClusterMember;
  isHidden: boolean;
  onToggleHide: (id: string) => void;
}) {
  const isCore = member.role === "core";

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
          background: isHidden ? "#eee" : isCore ? "#fff3e0" : "#f5f5f5",
          border: isCore ? "2px solid #ff9800" : "1px solid #ddd",
          borderRadius: "4px",
          textDecoration: "none",
          color: "inherit",
          fontSize: "14px",
          opacity: isHidden ? 0.5 : 1,
          fontWeight: isCore ? "bold" : "normal",
        }}
        title={`コア度: ${(member.coreness * 100).toFixed(0)}% / 次数: ${member.degree} / 投票数合計: ${member.voterWeightedDegree}`}
      >
        {isCore && (
          <span style={{ color: "#ff9800", fontSize: "12px" }} title="コアメンバー">
            ★
          </span>
        )}
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

  // PMI ≥ 3.0 を高PMIとする（期待の8倍以上の頻度で共起 = 強い関連性）
  const HIGH_PMI_THRESHOLD = 3.0;

  return (
    <details style={{ marginTop: "12px" }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: "14px",
          color: "#666",
          padding: "8px 0",
          margin: "0 0 8px 0",
        }}
      >
        ブランド横断ペア詳細（クリックで選出者を表示）- {edges.length}件
        <span style={{ marginLeft: "8px", fontSize: "12px", color: "#d4a017" }}>
          ★ PMI≥3.0（強い関連性）
        </span>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {sortedEdges.map((edge) => {
          const edgeKey = `${edge.idolA.id}-${edge.idolB.id}`;
          const isExpanded = expandedEdge === edgeKey;
          const isHighPmi = edge.pmi >= HIGH_PMI_THRESHOLD;

          return (
            <div
              key={edgeKey}
              style={{
                border: isHighPmi ? "2px solid #d4a017" : "1px solid #e0e0e0",
                borderRadius: "4px",
                background: isExpanded ? "#f9f0ff" : isHighPmi ? "#fffbeb" : "#fafafa",
                boxShadow: isHighPmi ? "0 2px 8px rgba(212, 160, 23, 0.2)" : undefined,
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
                {isHighPmi && (
                  <span style={{ color: "#d4a017", fontSize: "14px" }} title="PMI上位ペア">
                    ★
                  </span>
                )}
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
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "12px",
                    color: isHighPmi ? "#b8860b" : "#666",
                    fontWeight: isHighPmi ? "bold" : "normal",
                  }}
                >
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
    </details>
  );
}

function ClusterCard({ cluster, rank }: { cluster: CrossBrandCluster; rank: number }) {
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

  // コアメンバーとペリフェラルメンバーを分離（memberRolesを使用）
  const coreMembers = useMemo(
    () => cluster.memberRoles.filter((m) => m.role === "core"),
    [cluster.memberRoles]
  );
  const peripheralMembers = useMemo(
    () => cluster.memberRoles.filter((m) => m.role === "peripheral"),
    [cluster.memberRoles]
  );

  return (
    <ClusterCardContainer>
      <ClusterCardHeader>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <RankBadge rank={rank} variant="crossbrand" />
          {cluster.memberDetails.length}人 / {cluster.brandCount}ブランド
        </h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <StatLabel label="投票者" value={`${cluster.totalVoterCount}人`} />
          <StatLabel label="平均PMI" value={cluster.avgPmi.toFixed(2)} color="#8e44ad" />
          <StatLabel label="エッジ" value={`${cluster.edges.length}本`} />
          <StatLabel label="コア" value={`${coreMembers.length}人`} color="#ff9800" />
          <StatLabel
            label="コア密度"
            value={`${(cluster.coreDensity * 100).toFixed(0)}%`}
            color="#ff9800"
          />
        </div>
      </ClusterCardHeader>

      <GraphSection>
        {(width) => (
          <CrossBrandClusterGraph
            cluster={cluster}
            width={width}
            height={500}
            hiddenIds={hiddenIds}
          />
        )}
      </GraphSection>

      <BrandBreakdown brandCounts={brandCounts} />

      {/* コアメンバー */}
      {coreMembers.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#ff9800",
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>★</span>
            コアメンバー（{coreMembers.length}人）
            <span style={{ fontWeight: "normal", color: "#666", fontSize: "12px" }}>
              - クラスター内で多くのメンバーと強く接続
            </span>
          </div>
          <MemberTagList>
            {coreMembers.map((member) => (
              <MemberTag
                key={member.id}
                member={member}
                isHidden={hiddenIds.has(member.id)}
                onToggleHide={toggleHide}
              />
            ))}
          </MemberTagList>
        </div>
      )}

      {/* ペリフェラルメンバー */}
      {peripheralMembers.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#666",
              marginBottom: "6px",
            }}
          >
            周辺メンバー（{peripheralMembers.length}人）
          </div>
          <MemberTagList>
            {peripheralMembers.map((member) => (
              <MemberTag
                key={member.id}
                member={member}
                isHidden={hiddenIds.has(member.id)}
                onToggleHide={toggleHide}
              />
            ))}
          </MemberTagList>
        </div>
      )}

      <EdgeVotersList edges={cluster.edges} />
    </ClusterCardContainer>
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
      <ExplanationBox>
        <p>
          <strong>ブランド横断クラスタ</strong>
          は、異なるブランドのアイドル同士が共起として選ばれているグループです。
        </p>
        <p>
          ブランド横断ペア（異なるブランドのアイドルが同時に共起に選ばれている）のみを
          エッジとしてLouvain法でコミュニティ検出を行っています。
        </p>
      </ExplanationBox>

      <ClusterStats>
        <div>
          <strong>全体統計:</strong> {clusters.length}クラスタ / {stats.totalMembers}人
        </div>
        <div>平均サイズ: {stats.avgSize.toFixed(1)}人</div>
        <div>平均ブランド数: {stats.avgBrands.toFixed(1)}</div>
      </ClusterStats>

      <FilterContainer>
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
      </FilterContainer>

      <p style={{ marginBottom: "16px", color: "#666" }}>
        {filteredClusters.length} クラスタを表示中
      </p>

      {filteredClusters.map((cluster, index) => (
        <ClusterCard key={cluster.id} cluster={cluster} rank={index + 1} />
      ))}

      {filteredClusters.length === 0 && (
        <EmptyMessage message="条件に一致するクラスタがありません" />
      )}
    </div>
  );
}
