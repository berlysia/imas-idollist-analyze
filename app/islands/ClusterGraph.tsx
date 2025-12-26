import { useRef } from "react";
import type { Brand } from "../types";
import { BRAND_COLORS } from "../lib/constants";
import { GraphLegend, LegendNode } from "../components/shared";
import {
  useForceSimulation,
  type SimulationNode,
  type SimulationEdge,
} from "../hooks/useForceSimulation";
import { useGraphInteraction } from "../hooks/useGraphInteraction";

interface ClusterMember {
  id: string;
  name: string;
  brand: Brand[];
  coreness: number;
  degree: number;
  weightSum: number;
  role: "core" | "peripheral";
}

interface WeightedEdge {
  source: string;
  target: string;
  directionality: number;
  weight: number;
}

interface Cluster {
  memberRoles: ClusterMember[];
  coreMembers: string[];
  edges: WeightedEdge[];
}

interface Props {
  cluster: Cluster;
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
  weight: number;
  directionality: number;
}

export default function ClusterGraph({
  cluster,
  width = 700,
  height = 500,
  hiddenIds = new Set(),
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const coreSet = new Set(cluster.coreMembers);

  // フィルタリングされたメンバーとエッジ
  const visibleMembers = cluster.memberRoles.filter((m) => !hiddenIds.has(m.id));
  const visibleMemberIds = new Set(visibleMembers.map((m) => m.id));

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
    .filter((e) => visibleMemberIds.has(e.source) && visibleMemberIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      directionality: e.directionality,
      strength: 0.3 + (e.weight / Math.max(...cluster.edges.map((x) => x.weight), 1)) * 0.4,
    }));

  const maxWeight = Math.max(...edges.map((l) => l.weight), 1);

  // フォースシミュレーション
  const { renderNodes, simNodesRef, alphaRef, updateRenderNodes } = useForceSimulation<GraphNode>({
    nodes,
    edges,
    width,
    height,
    config: {
      edgeStrength: 0.3,
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
        style={{
          cursor: cursorStyle,
          background: "#fafafa",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      >
        <defs>
          {/* 片方向矢印（グレー） */}
          <marker
            id="arrow-uni"
            viewBox="0 -5 10 10"
            refX={20}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#999" />
          </marker>
          {/* 双方向矢印（青）- 終点 */}
          <marker
            id="arrow-bi-end"
            viewBox="0 -5 10 10"
            refX={20}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#1976d2" />
          </marker>
          {/* 双方向矢印（青）- 始点 */}
          <marker
            id="arrow-bi-start"
            viewBox="0 -5 10 10"
            refX={-10}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M10,-5L0,0L10,5" fill="#1976d2" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* エッジ */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isBidirectional = edge.directionality === 2;
            const strokeColor = isBidirectional ? "#1976d2" : "#999";
            const strokeWidth = 1 + (edge.weight / maxWeight) * 4;

            return (
              <line
                key={`${edge.source}-${edge.target}-${idx}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={strokeColor}
                strokeOpacity={0.6}
                strokeWidth={strokeWidth}
                markerEnd={isBidirectional ? "url(#arrow-bi-end)" : "url(#arrow-uni)"}
                markerStart={isBidirectional ? "url(#arrow-bi-start)" : undefined}
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

            return (
              <text
                key={`label-${edge.source}-${edge.target}-${idx}`}
                x={midX}
                y={midY}
                fontSize="9px"
                fill="#666"
                textAnchor="middle"
                dy={-3}
              >
                {edge.weight.toFixed(1)}
              </text>
            );
          })}

          {/* ノード */}
          {renderNodes.map((node) => {
            const isCore = coreSet.has(node.id);
            const isPinned = node.fx !== null && node.fy !== null;
            const nodeRadius = 8 + node.coreness * 12;
            const displayName = node.name.split(" ").pop() ?? node.name;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => handleDoubleClick(e, node.id)}
              >
                {/* コアメンバーの外輪 */}
                {isCore && (
                  <circle
                    r={nodeRadius + 5}
                    fill="none"
                    stroke="#1976d2"
                    strokeWidth={1}
                    strokeDasharray="3,2"
                  />
                )}
                {/* ピン留めインジケータ */}
                {isPinned && (
                  <circle r={nodeRadius + 3} fill="none" stroke="#4caf50" strokeWidth={2} />
                )}
                {/* メインサークル */}
                <circle
                  r={nodeRadius}
                  fill={BRAND_COLORS[node.brand[0] ?? "imas"]}
                  stroke={isCore ? "#1976d2" : "#fff"}
                  strokeWidth={isCore ? 3 : 1.5}
                />
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
                <text fontSize="10px" textAnchor="middle" dy={nodeRadius + 12} fill="#333">
                  {displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <GraphLegend>
        <div style={{ marginBottom: "2px" }}>
          <svg width="24" height="12" style={{ verticalAlign: "middle", marginRight: "4px" }}>
            <defs>
              <marker
                id="legend-arrow-bi-end"
                viewBox="0 -3 6 6"
                refX="6"
                refY="0"
                markerWidth="4"
                markerHeight="4"
                orient="auto"
              >
                <path d="M0,-3L6,0L0,3" fill="#1976d2" />
              </marker>
              <marker
                id="legend-arrow-bi-start"
                viewBox="0 -3 6 6"
                refX="0"
                refY="0"
                markerWidth="4"
                markerHeight="4"
                orient="auto"
              >
                <path d="M6,-3L0,0L6,3" fill="#1976d2" />
              </marker>
            </defs>
            <line
              x1="4"
              y1="6"
              x2="20"
              y2="6"
              stroke="#1976d2"
              strokeWidth="2"
              markerEnd="url(#legend-arrow-bi-end)"
              markerStart="url(#legend-arrow-bi-start)"
            />
          </svg>
          双方向（相互選択）
        </div>
        <div style={{ marginBottom: "2px" }}>
          <svg width="24" height="12" style={{ verticalAlign: "middle", marginRight: "4px" }}>
            <defs>
              <marker
                id="legend-arrow-uni"
                viewBox="0 -3 6 6"
                refX="6"
                refY="0"
                markerWidth="4"
                markerHeight="4"
                orient="auto"
              >
                <path d="M0,-3L6,0L0,3" fill="#999" />
              </marker>
            </defs>
            <line
              x1="2"
              y1="6"
              x2="20"
              y2="6"
              stroke="#999"
              strokeWidth="2"
              markerEnd="url(#legend-arrow-uni)"
            />
          </svg>
          片方向（一方のみ選択）
        </div>
        <LegendNode color="#1976d2" label="コア" />
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
