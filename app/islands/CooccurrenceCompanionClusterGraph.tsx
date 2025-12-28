import { useRef } from "react";
import type { Brand } from "../types";
import { BRAND_COLORS } from "../lib/constants";
import { GraphLegend, LegendLine } from "../components/shared";
import {
  useForceSimulation,
  type SimulationNode,
  type SimulationEdge,
} from "../hooks/useForceSimulation";
import { useGraphInteraction } from "../hooks/useGraphInteraction";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CooccurrenceCompanionClusterMember {
  id: string;
  name: string;
  brand: Brand[];
  coreness: number;
  role: "core" | "peripheral";
}

interface CooccurrenceCompanionEdge {
  idolA: IdolInfo;
  idolB: IdolInfo;
  /** 共起元の数（このペアを同時に随伴しているアイドルの数） */
  cooccurrenceSourceCount: number;
  pmi: number;
}

interface CooccurrenceCompanionCluster {
  memberDetails: IdolInfo[];
  memberRoles: CooccurrenceCompanionClusterMember[];
  edges: CooccurrenceCompanionEdge[];
}

interface Props {
  cluster: CooccurrenceCompanionCluster;
  width?: number;
  height?: number;
  hiddenIds?: Set<string>;
}

interface GraphNode extends SimulationNode {
  name: string;
  brand: Brand[];
  coreness: number;
  role: "core" | "peripheral";
}

interface GraphEdge extends SimulationEdge {
  cooccurrenceSourceCount: number;
  pmi: number;
}

// PMI ≥ 3.0 を高PMIとする（期待の8倍以上の頻度で共起 = 強い関連性）
const HIGH_PMI_THRESHOLD = 3.0;

export default function CooccurrenceCompanionClusterGraph({
  cluster,
  width = 700,
  height = 500,
  hiddenIds = new Set(),
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // フィルタリングされたメンバーとエッジ
  const visibleMembers = cluster.memberRoles.filter((m) => !hiddenIds.has(m.id));
  const visibleMemberIds = new Set(visibleMembers.map((m) => m.id));

  // 表示するノードがない場合は空を返す
  if (visibleMembers.length === 0) {
    return (
      <div style={{ position: "relative" }}>
        <svg
          width={width}
          height={height}
          style={{
            background: "#fafafa",
            borderRadius: "8px",
            border: "1px solid #eee",
          }}
        />
      </div>
    );
  }

  const nodes: GraphNode[] = visibleMembers.map((m) => ({
    id: m.id,
    name: m.name,
    brand: m.brand,
    coreness: m.coreness,
    role: m.role,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null,
  }));

  const edges: GraphEdge[] = cluster.edges
    .filter((e) => visibleMemberIds.has(e.idolA.id) && visibleMemberIds.has(e.idolB.id))
    .map((e) => ({
      source: e.idolA.id,
      target: e.idolB.id,
      cooccurrenceSourceCount: e.cooccurrenceSourceCount,
      pmi: e.pmi,
      // PMIとcooccurrenceSourceCountを組み合わせたエッジ強度
      strength: 0.2 + (e.pmi >= HIGH_PMI_THRESHOLD ? 0.3 : 0.1),
    }));

  const maxCooccurrenceSourceCount = Math.max(...edges.map((l) => l.cooccurrenceSourceCount), 1);
  const maxPmi = Math.max(...edges.map((l) => l.pmi), 1);

  // 正規化した共起元数とPMIを組み合わせた重み
  const getWeight = (l: GraphEdge) => {
    const normSource = l.cooccurrenceSourceCount / maxCooccurrenceSourceCount;
    const normPmi = l.pmi / maxPmi;
    return normSource * 0.6 + normPmi * 0.4;
  };

  const isHighPmi = (l: GraphEdge) => l.pmi >= HIGH_PMI_THRESHOLD;

  // フォースシミュレーション
  const { renderNodes, simNodesRef, alphaRef, updateRenderNodes } = useForceSimulation<GraphNode>({
    nodes,
    edges,
    width,
    height,
    config: {
      edgeStrength: 0.2,
    },
  });

  // インタラクション（ドラッグ、パン、ズーム、ピン留め）
  const {
    transform,
    handleNodeMouseDown,
    handleBackgroundMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    cursorStyle,
    handleNodeTouchStart,
    handleBackgroundTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useGraphInteraction({
    svgRef,
    simNodesRef,
    alphaRef,
    updateRenderNodes,
  });

  const nodeMap = new Map(renderNodes.map((n) => [n.id, n]));

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleBackgroundTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          cursor: cursorStyle,
          background: "#fafafa",
          borderRadius: "8px",
          border: "1px solid #eee",
          touchAction: "none",
        }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* エッジ */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const highPmi = isHighPmi(edge);
            const strokeColor = highPmi ? "#d4a017" : "#8e44ad";
            const strokeWidth = highPmi ? 3 + getWeight(edge) * 5 : 1 + getWeight(edge) * 5;

            return (
              <line
                key={`${edge.source}-${edge.target}-${idx}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={strokeColor}
                strokeOpacity={highPmi ? 0.9 : 0.6}
                strokeWidth={strokeWidth}
              />
            );
          })}

          {/* エッジラベル */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            const highPmi = isHighPmi(edge);

            return (
              <text
                key={`label-${edge.source}-${edge.target}-${idx}`}
                x={midX}
                y={midY}
                fontSize={highPmi ? "10px" : "9px"}
                fill={highPmi ? "#b8860b" : "#666"}
                fontWeight={highPmi ? "bold" : "normal"}
                textAnchor="middle"
                dy={-3}
              >
                {highPmi ? "★ " : ""}
                {edge.cooccurrenceSourceCount}人 / PMI:{edge.pmi.toFixed(1)}
              </text>
            );
          })}

          {/* ノード */}
          {renderNodes.map((node) => {
            const isCore = node.role === "core";
            const isPinned = node.fx !== null && node.fy !== null;
            const nodeRadius = isCore ? 18 : 12;
            const displayName = node.name.split(" ").pop() ?? node.name;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => handleDoubleClick(e, node.id)}
                onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
                onTouchEnd={handleTouchEnd}
              >
                {/* ピン留めインジケータ */}
                {isPinned && (
                  <circle r={nodeRadius + 3} fill="none" stroke="#4caf50" strokeWidth={2} />
                )}
                {/* メインサークル */}
                <circle
                  r={nodeRadius}
                  fill={BRAND_COLORS[node.brand[0] ?? "imas"]}
                  stroke={isCore ? "#ff9800" : "#fff"}
                  strokeWidth={isCore ? 4 : 2}
                />
                {/* コアメンバーの★マーク */}
                {isCore && (
                  <text fontSize="10px" textAnchor="middle" dy={-24} fill="#ff9800">
                    ★
                  </text>
                )}
                {/* ピンアイコン */}
                {isPinned && (
                  <circle
                    r={4}
                    cx={nodeRadius - 2}
                    cy={-nodeRadius + 2}
                    fill="#4caf50"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                )}
                {/* 名前ラベル */}
                <text
                  fontSize={isCore ? "11px" : "10px"}
                  fontWeight={isCore ? "bold" : "normal"}
                  textAnchor="middle"
                  dy={isCore ? 32 : 24}
                  fill="#333"
                >
                  {displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <GraphLegend>
        <LegendLine color="#d4a017" width={4} label="PMI≥3.0（強い関連性）" bold icon="★" />
        <LegendLine color="#8e44ad" width={3} label="共起随伴ペア（太いほど多くの共起元）" />
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <span
            style={{
              display: "inline-block",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "3px solid #ff9800",
              background: "#f5f5f5",
            }}
          />
          <span>コアメンバー（多くのメンバーと強く接続）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              border: "2px solid #4caf50",
              background: "#f5f5f5",
            }}
          />
          <span>ピン留め（ダブルクリックで切替）</span>
        </div>
      </GraphLegend>
    </div>
  );
}
