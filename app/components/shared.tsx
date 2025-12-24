import * as React from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES, SITE_TITLE } from "../lib/constants";

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

/**
 * 共通ヘッダー
 */
export function PageHeader({ metadata }: { metadata: MetadataData }) {
  return (
    <header style={{ marginBottom: "12px" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
        <a href="/">{SITE_TITLE}</a>
      </h1>
      <p className="metadata" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
        データ取得日: {new Date(metadata.scrapedAt).toLocaleDateString("ja-JP")} /{" "}
        {metadata.idolCount}人のアイドル
      </p>
    </header>
  );
}

const TAB_ITEMS = [
  { href: "/idol-list", label: "アイドル一覧" },
  { href: "/incoming-ranking", label: "被随伴ランキング" },
  { href: "/mutual-pairs", label: "相互随伴ペア" },
  { href: "/cooccurrence-companion-pairs", label: "共起随伴ペア" },
  { href: "/accompaniment-clusters", label: "随伴クラスタ" },
  { href: "/cooccurrence-companion-clusters", label: "共起随伴クラスタ" },
  { href: "/graph-explorer", label: "グラフ探索" },
] as const;

/**
 * ナビゲーションタブ
 */
export function NavigationTabs({
  activeTab,
  variant = "default",
}: {
  activeTab: string;
  variant?: "default" | "cooccurrence";
}) {
  const activeColor = variant === "cooccurrence" ? "#8e44ad" : "#333";

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        background: "#fff",
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 12px",
        padding: "8px 0",
        marginBottom: "4px",
        fontSize: "0.85rem",
        zIndex: 100,
      }}
    >
      {TAB_ITEMS.map((item) => {
        const isActive = item.href === activeTab;
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              color: isActive ? activeColor : "#666",
              textDecoration: "none",
              fontWeight: isActive ? "bold" : "normal",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * 共通フッター
 */
export function PageFooter() {
  return (
    <footer>
      <p>
        データ出典:{" "}
        <a
          href="https://idollist.idolmaster-official.jp/"
          target="_blank"
          rel="noopener noreferrer"
        >
          アイドルマスターOFFICIAL WEB アイドル名鑑
        </a>
      </p>
    </footer>
  );
}

/**
 * ブランドを示す小さなドットアイコン
 */
export function BrandDot({ brand, size = "small" }: { brand: Brand; size?: "small" | "large" }) {
  const SIZE = {
    small: 12,
    large: 20,
  };
  return (
    <span
      className="brand-dot"
      style={{
        display: "inline-block",
        backgroundColor: BRAND_COLORS[brand],
        width: SIZE[size],
        height: SIZE[size],
      }}
      title={BRAND_NAMES[brand]}
    />
  );
}

/**
 * クラスタカードのランクバッジ
 */
export function RankBadge({
  rank,
  variant = "default",
}: {
  rank: number;
  variant?: "default" | "cooccurrence";
}) {
  const bgColor = variant === "cooccurrence" ? "#8e44ad" : "#333";
  return (
    <span
      style={{
        background: bgColor,
        color: "#fff",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "14px",
        fontWeight: "bold",
      }}
    >
      #{rank}
    </span>
  );
}

/**
 * グラフ表示トグルボタン
 */
export function GraphToggleButton({
  showGraph,
  onClick,
  variant = "default",
}: {
  showGraph: boolean;
  onClick: () => void;
  variant?: "default" | "cooccurrence";
}) {
  const activeColor = variant === "cooccurrence" ? "#8e44ad" : "#1976d2";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 8px",
        background: showGraph ? activeColor : "#e0e0e0",
        color: showGraph ? "#fff" : "#333",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "12px",
      }}
    >
      {showGraph ? "グラフを隠す" : "グラフ表示"}
    </button>
  );
}

/**
 * クラスタ全体統計表示
 */
export function ClusterStats({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

/**
 * フィルターコンテナ
 */
export function FilterContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="filters"
      style={{ marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}
    >
      {children}
    </div>
  );
}

/**
 * 説明テキストコンテナ
 */
export function ExplanationBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="cluster-explanation" style={{ marginBottom: "16px" }}>
      {children}
    </div>
  );
}

/**
 * クラスタカードコンテナ
 */
export function ClusterCardContainer({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="cluster-card"
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        background: "#fff",
      }}
    >
      {children}
    </div>
  );
}

/**
 * クラスタカードヘッダー
 */
export function ClusterCardHeader({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

/**
 * ブランド内訳表示
 */
export function BrandBreakdown({ brandCounts }: { brandCounts: [Brand, number][] }) {
  return (
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
  );
}

/**
 * メンバータグリスト
 */
export function MemberTagList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}

/**
 * 空の結果メッセージ
 */
export function EmptyMessage({ message }: { message: string }) {
  return <p style={{ textAlign: "center", color: "#999", padding: "32px" }}>{message}</p>;
}

/**
 * グラフの凡例コンテナ
 */
export function GraphLegend({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "8px",
        left: "8px",
        fontSize: "10px",
        color: "#666",
        background: "rgba(255,255,255,0.9)",
        padding: "4px 8px",
        borderRadius: "4px",
      }}
    >
      {children}
    </div>
  );
}

/**
 * 凡例のライン（エッジの説明用）
 */
export function LegendLine({
  color,
  width = 2,
  label,
  bold = false,
  icon,
}: {
  color: string;
  width?: number;
  label: string;
  bold?: boolean;
  icon?: string;
}) {
  return (
    <div style={{ marginBottom: "2px" }}>
      <span
        style={{
          display: "inline-block",
          width: "20px",
          height: `${Math.max(width, 2)}px`,
          background: color,
          marginRight: "4px",
          verticalAlign: "middle",
        }}
      />
      <span style={{ color: bold ? color : undefined, fontWeight: bold ? "bold" : "normal" }}>
        {icon && <span style={{ marginRight: "2px" }}>{icon}</span>}
        {label}
      </span>
    </div>
  );
}

/**
 * 凡例のノード（コア/周辺の説明用）
 */
export function LegendNode({
  color,
  dashed = false,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <div>
      <span
        style={{
          display: "inline-block",
          width: "10px",
          height: "10px",
          border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
          borderRadius: "50%",
          marginRight: "4px",
          verticalAlign: "middle",
        }}
      />
      {label}
    </div>
  );
}

/**
 * グラフのSVGコンテナ
 */
export function GraphSvgContainer({
  svgRef,
  width,
  height,
  children,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  width: number;
  height: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: "#fafafa",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      />
      {children}
    </div>
  );
}

/**
 * 統計値の小さなラベル
 */
export function StatLabel({
  label,
  value,
  color = "#666",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <span style={{ fontSize: "12px", color }}>
      {label}: {value}
    </span>
  );
}

/**
 * グラフセクション（リサイズ対応）
 */
export function GraphSection({ children }: { children: (width: number) => React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(700);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ marginBottom: "16px" }}>
      {children(containerWidth)}
    </div>
  );
}
