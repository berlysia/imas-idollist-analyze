import { useState, useMemo } from "react";
import type { Brand } from "../types";
import { BRAND_NAMES, ALL_BRANDS } from "../lib/constants";
import ClusterGraph from "./ClusterGraph";
import {
  BrandDot,
  RankBadge,
  ClusterStats,
  FilterContainer,
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

interface WeightedEdge {
  source: string;
  target: string;
  directionality: number;
  weight: number;
}

interface ClusterMember {
  id: string;
  name: string;
  brand: Brand[];
  coreness: number;
  degree: number;
  weightSum: number;
  role: "core" | "peripheral";
}

interface Cluster {
  id: number;
  members: string[];
  memberDetails: IdolInfo[];
  memberRoles: ClusterMember[];
  coreMembers: string[];
  peripheralMembers: string[];
  totalWeight: number;
  density: number;
  coreDensity: number;
  dominantBrands: Brand[];
  edges: WeightedEdge[];
}

interface Props {
  clusters: Cluster[];
}

function MemberTag({
  member,
  isCore,
  isHidden,
  onToggleHide,
}: {
  member: ClusterMember;
  isCore: boolean;
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
          background: isHidden ? "#eee" : isCore ? "#e3f2fd" : "#f5f5f5",
          border: isCore && !isHidden ? "2px solid #1976d2" : "1px solid #ddd",
          borderRadius: "4px",
          textDecoration: "none",
          color: "inherit",
          fontSize: "14px",
          fontWeight: isCore ? "bold" : "normal",
          opacity: isHidden ? 0.5 : 1,
        }}
        title={`コア度: ${(member.coreness * 100).toFixed(0)}% / 次数: ${member.degree} / 重み: ${member.weightSum.toFixed(1)}`}
      >
        {member.brand.map((b) => (
          <BrandDot key={b} brand={b} />
        ))}
        <span style={{ textDecoration: isHidden ? "line-through" : "none" }}>{member.name}</span>
        {isCore && !isHidden && (
          <span style={{ fontSize: "10px", color: "#1976d2", marginLeft: "2px" }}>*</span>
        )}
      </a>
    </span>
  );
}

function ClusterCard({
  cluster,
  rank,
  originalIndex,
}: {
  cluster: Cluster;
  rank: number;
  originalIndex: number;
}) {
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

  const coreSet = useMemo(() => new Set(cluster.coreMembers), [cluster.coreMembers]);

  const displayMembers = cluster.memberRoles;

  const graphExplorerUrl = useMemo(() => {
    const ids = cluster.members.join(",");
    return `/graph-explorer?mode=bottomup&ids=${encodeURIComponent(ids)}`;
  }, [cluster.members]);

  return (
    <ClusterCardContainer id={`cluster-${originalIndex}`}>
      <ClusterCardHeader>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <RankBadge rank={rank} />
          {cluster.memberRoles.length}人のクラスタ
          <a
            href={graphExplorerUrl}
            style={{
              fontSize: "12px",
              fontWeight: "normal",
              color: "#1976d2",
              textDecoration: "none",
              padding: "2px 8px",
              background: "#e3f2fd",
              borderRadius: "4px",
              marginLeft: "4px",
            }}
            title="このクラスタのメンバーをボトムアップグラフ探索で開く"
          >
            グラフ探索 →
          </a>
        </h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <StatLabel label="密度" value={`${(cluster.density * 100).toFixed(0)}%`} />
          <StatLabel
            label="コア"
            value={`${cluster.coreMembers.length}人 (${(cluster.coreDensity * 100).toFixed(0)}%)`}
            color="#1976d2"
          />
          <StatLabel label="周辺" value={`${cluster.peripheralMembers.length}人`} />
        </div>
      </ClusterCardHeader>

      <GraphSection>
        {(width) => (
          <ClusterGraph cluster={cluster} width={width} height={500} hiddenIds={hiddenIds} />
        )}
      </GraphSection>

      <BrandBreakdown brandCounts={brandCounts} />

      <div style={{ marginBottom: "8px", fontSize: "12px", color: "#666" }}>
        <span style={{ color: "#1976d2", fontWeight: "bold" }}>*</span> = コアメンバー
        （クラスタ内で密に結合）
      </div>

      <MemberTagList>
        {displayMembers.map((member) => (
          <MemberTag
            key={member.id}
            member={member}
            isCore={coreSet.has(member.id)}
            isHidden={hiddenIds.has(member.id)}
            onToggleHide={toggleHide}
          />
        ))}
      </MemberTagList>
    </ClusterCardContainer>
  );
}

export default function ClusterList({ clusters }: Props) {
  const [brandFilter, setBrandFilter] = useState<Brand | null>(null);
  const [minSize, setMinSize] = useState(3);

  const filteredClusters = useMemo(() => {
    return clusters
      .map((cluster, originalIndex) => ({ cluster, originalIndex }))
      .filter(({ cluster }) => {
        if (cluster.memberDetails.length < minSize) return false;
        if (brandFilter) {
          return cluster.dominantBrands.includes(brandFilter);
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
    const avgDensity =
      clusters.length > 0 ? clusters.reduce((sum, c) => sum + c.density, 0) / clusters.length : 0;
    return { totalMembers, avgSize, avgDensity };
  }, [clusters]);

  return (
    <>
      <ClusterStats>
        <div>
          <strong>全体統計:</strong> {clusters.length}クラスタ / {stats.totalMembers}人
        </div>
        <div>平均サイズ: {stats.avgSize.toFixed(1)}人</div>
        <div>平均密度: {(stats.avgDensity * 100).toFixed(0)}%</div>
      </ClusterStats>

      <FilterContainer>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          主要ブランド:
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

      {filteredClusters.map(({ cluster, originalIndex }, index) => (
        <ClusterCard
          key={cluster.id}
          cluster={cluster}
          rank={index + 1}
          originalIndex={originalIndex}
        />
      ))}

      {filteredClusters.length === 0 && (
        <EmptyMessage message="条件に一致するクラスタがありません" />
      )}
    </>
  );
}
