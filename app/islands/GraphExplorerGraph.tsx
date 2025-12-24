import { useEffect, useRef, useState, useCallback } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../lib/constants";
import type { ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";

interface GraphNode {
  id: string;
  name: string;
  brand: Brand[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

interface Props {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  width: number;
  height: number;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  setNodes: React.Dispatch<React.SetStateAction<Map<string, ExplorerNode>>>;
}

export default function GraphExplorerGraph({
  nodes,
  edges,
  width,
  height,
  selectedNodeId,
  onBackgroundClick,
  onNodeClick,
  setNodes,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  // Simulation state (mutable, for physics)
  const simNodesRef = useRef<GraphNode[]>([]);
  // Render state (immutable, for React)
  const [renderNodes, setRenderNodes] = useState<GraphNode[]>([]);
  const edgesRef = useRef(edges);
  const alphaRef = useRef(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Keep edges ref in sync
  edgesRef.current = edges;

  // Track previous node count to detect actual node changes
  const prevNodeCountRef = useRef(0);

  // Initialize/update simulation nodes when props change
  useEffect(() => {
    const existingById = new Map(simNodesRef.current.map((n) => [n.id, n]));

    const newSimNodes = nodes.map((n, i) => {
      const existing = existingById.get(n.id);
      if (existing) {
        // Keep existing simulation state
        existing.name = n.name;
        existing.brand = n.brand;
        return existing;
      }
      // New node
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      const radius = Math.min(width, height) / 3;
      return {
        id: n.id,
        name: n.name,
        brand: n.brand,
        x: n.x ?? width / 2 + radius * Math.cos(angle),
        y: n.y ?? height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        fx: n.fx ?? null,
        fy: n.fy ?? null,
      };
    });

    simNodesRef.current = newSimNodes;

    // Only restart simulation when nodes actually change (not on resize)
    const nodesChanged =
      nodes.length !== prevNodeCountRef.current || nodes.some((n) => !existingById.has(n.id));
    if (nodesChanged) {
      alphaRef.current = 1;
      prevNodeCountRef.current = nodes.length;
    }

    // Immediately update render state
    setRenderNodes(newSimNodes.map((n) => ({ ...n })));
  }, [nodes, width, height]);

  // Refs for width/height to avoid re-starting simulation on resize
  const sizeRef = useRef({ width, height });
  const prevSizeRef = useRef({ width, height });

  // When container size changes significantly, recenter nodes
  useEffect(() => {
    const prevWidth = prevSizeRef.current.width;
    const prevHeight = prevSizeRef.current.height;

    // Check if size changed significantly (more than 100px difference)
    const widthDiff = Math.abs(width - prevWidth);
    const heightDiff = Math.abs(height - prevHeight);

    if (widthDiff > 100 || heightDiff > 100) {
      // Calculate offset to shift nodes to new center
      const offsetX = (width - prevWidth) / 2;
      const offsetY = (height - prevHeight) / 2;

      // Shift all simulation nodes to new center
      for (const node of simNodesRef.current) {
        node.x += offsetX;
        node.y += offsetY;
        if (node.fx !== null) {
          node.fx += offsetX;
        }
        if (node.fy !== null) {
          node.fy += offsetY;
        }
      }

      // Update render state immediately
      setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
    }

    prevSizeRef.current = { width, height };
    sizeRef.current = { width, height };
  }, [width, height]);

  // Force simulation - runs once and uses refs for dynamic values
  useEffect(() => {
    const damping = 0.9;
    let running = true;

    function simulate() {
      if (!running) return;

      const simNodes = simNodesRef.current;
      const currentEdges = edgesRef.current;
      const { width: currentWidth, height: currentHeight } = sizeRef.current;
      const centerX = currentWidth / 2;
      const centerY = currentHeight / 2;

      if (simNodes.length === 0) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }

      const alpha = alphaRef.current;
      if (alpha < 0.005) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }
      alphaRef.current *= 0.95;

      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const nodeCount = simNodes.length;

      // ノード数に応じてパラメータを調整（より広がるように）
      const k = Math.max(80, Math.min(150, 300 / Math.sqrt(nodeCount + 1)));
      // 中心への引力は控えめに（端に溜まらない程度）
      const gravity = 0.01 + Math.min(0.03, nodeCount * 0.0002);

      // Apply forces (mutate simulation nodes directly)
      for (const node of simNodes) {
        if (node.fx !== null && node.fy !== null) continue;
        node.vx *= damping;
        node.vy *= damping;

        // 中心への引力（境界から離れるほど弱く、中心近くでは働かない）
        const distFromCenter = Math.sqrt((node.x - centerX) ** 2 + (node.y - centerY) ** 2);
        const maxDist = Math.min(currentWidth, currentHeight) / 2;
        // 中心から一定距離以上離れた場合のみ引力を適用
        if (distFromCenter > maxDist * 0.6) {
          const gravityForce = gravity * ((distFromCenter - maxDist * 0.6) / maxDist);
          node.vx += (centerX - node.x) * gravityForce * 0.01;
          node.vy += (centerY - node.y) * gravityForce * 0.01;
        }
      }

      // Repulsion（ノード間の反発力）
      for (let i = 0; i < simNodes.length; i++) {
        const nodeI = simNodes[i];
        if (!nodeI) continue;
        for (let j = i + 1; j < simNodes.length; j++) {
          const nodeJ = simNodes[j];
          if (!nodeJ) continue;
          const dx = nodeJ.x - nodeI.x;
          const dy = nodeJ.y - nodeI.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // 近距離では強い反発、遠距離では弱い反発
          const force = ((k * k) / (dist * dist + 100)) * alpha * 1.5;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (nodeI.fx === null) {
            nodeI.vx -= fx;
            nodeI.vy -= fy;
          }
          if (nodeJ.fx === null) {
            nodeJ.vx += fx;
            nodeJ.vy += fy;
          }
        }
      }

      // Spring force for edges
      for (const edge of currentEdges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const strength = 0.3 + (edge.isMutual ? 0.3 : 0);
        const force = (dist - k) * 0.05 * strength * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (source.fx === null) {
          source.vx += fx;
          source.vy += fy;
        }
        if (target.fx === null) {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // Update positions（境界制限なし、画面外にも広がれる）
      for (const node of simNodes) {
        if (node.fx !== null) {
          node.x = node.fx;
        } else {
          node.x += node.vx;
        }
        if (node.fy !== null) {
          node.y = node.fy;
        } else {
          node.y += node.vy;
        }
      }

      // Copy to render state (new objects for React)
      setRenderNodes(simNodes.map((n) => ({ ...n })));
      animationRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, []); // 依存配列を空に - シミュレーションは一度だけ開始

  // Save positions to parent when simulation stabilizes
  useEffect(() => {
    if (renderNodes.length === 0) return;

    const timeout = setTimeout(() => {
      setNodes((prev) => {
        const next = new Map(prev);
        renderNodes.forEach((gn) => {
          const existing = next.get(gn.id);
          if (existing) {
            next.set(gn.id, {
              ...existing,
              x: gn.x,
              y: gn.y,
              fx: gn.fx,
              fy: gn.fy,
            });
          }
        });
        return next;
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [renderNodes, setNodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragNodeId(nodeId);
  }, []);

  // 背景クリックでパン開始
  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // ノードドラッグ中はパンしない
      if (isDragging) return;

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [isDragging, transform]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // ノードドラッグ
      if (isDragging && dragNodeId && svgRef.current) {
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.x) / transform.scale;
        const y = (e.clientY - rect.top - transform.y) / transform.scale;

        const node = simNodesRef.current.find((n) => n.id === dragNodeId);
        if (node) {
          node.x = x;
          node.y = y;
          node.fx = x;
          node.fy = y;
          setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
        }
        return;
      }

      // 背景パン
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          x: panStartRef.current.tx + dx,
          y: panStartRef.current.ty + dy,
        }));
      }
    },
    [isDragging, dragNodeId, transform, isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragNodeId(null);
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    // Toggle fixed position
    const node = simNodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      if (node.fx !== null && node.fy !== null) {
        // Unpin: clear fixed position
        node.fx = null;
        node.fy = null;
      } else {
        // Pin: set fixed position to current position
        node.fx = node.x;
        node.fy = node.y;
      }
      setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
      // Restart simulation slightly to let other nodes adjust
      alphaRef.current = Math.max(alphaRef.current, 0.3);
    }
  }, []);

  // Wheel zoom - must use non-passive listener for preventDefault to work
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;

      setTransform((prev) => {
        const newScale = Math.max(0.3, Math.min(3, prev.scale * scaleFactor));
        const actualFactor = newScale / prev.scale;
        // マウス位置を中心にズーム
        const newX = mouseX - (mouseX - prev.x) * actualFactor;
        const newY = mouseY - (mouseY - prev.y) * actualFactor;
        return { x: newX, y: newY, scale: newScale };
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const nodeMap = new Map(renderNodes.map((n) => [n.id, n]));

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onClick={onBackgroundClick}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? "grabbing" : isPanning ? "grabbing" : "grab",
          background: "#fafafa",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      >
        <defs>
          <marker
            id="explorer-arrow-uni"
            viewBox="0 -5 10 10"
            refX={25}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#999" />
          </marker>
          {/* 共起随伴ペア用マーカー（高PMI） */}
          <marker
            id="explorer-arrow-highpmi"
            viewBox="0 -5 10 10"
            refX={25}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#d4a017" />
          </marker>
          {/* 共起随伴ペア用マーカー（通常） */}
          <marker
            id="explorer-arrow-cooccurrence"
            viewBox="0 -5 10 10"
            refX={25}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#8e44ad" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const edgeKey = `${edge.edgeType}-${edge.source}-${edge.target}-${idx}`;

            // 共起随伴ペア
            if (edge.edgeType === "cooccurrenceCompanion") {
              const isHighPmi = (edge.pmi ?? 0) >= 3.0;
              const strokeColor = isHighPmi ? "#d4a017" : "#8e44ad";
              const strokeWidth = 1 + (edge.cooccurrenceSourceCount ?? 1) * 2;

              return (
                <line
                  key={edgeKey}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={strokeColor}
                  strokeOpacity={isHighPmi ? 0.9 : 0.6}
                  strokeWidth={strokeWidth}
                />
              );
            }

            // 随伴関係
            if (edge.isMutual) {
              // 相互随伴: 矢印なし、中央に丸
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;
              return (
                <g key={edgeKey}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#1976d2"
                    strokeOpacity={0.6}
                    strokeWidth={1 + edge.weight * 3}
                  />
                  <circle cx={midX} cy={midY} r={4} fill="#1976d2" />
                </g>
              );
            }

            // 片方向随伴: 矢印あり
            return (
              <line
                key={edgeKey}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#999"
                strokeOpacity={0.6}
                strokeWidth={1 + edge.weight * 3}
                markerEnd="url(#explorer-arrow-uni)"
              />
            );
          })}

          {/* Nodes */}
          {renderNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isPinned = node.fx !== null && node.fy !== null;
            const displayName = (() => {
              const parts = node.name.split(" ");
              return parts.length > 1 ? (parts[parts.length - 1] ?? node.name) : node.name;
            })();

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDragging) {
                    onNodeClick(node.id);
                  }
                }}
                onDoubleClick={(e) => handleDoubleClick(e, node.id)}
              >
                {isSelected && (
                  <circle
                    r={26}
                    fill="none"
                    stroke="#ff9800"
                    strokeWidth={2}
                    strokeDasharray="4,2"
                  />
                )}
                <circle
                  r={20}
                  fill={BRAND_COLORS[node.brand[0] ?? "imas"]}
                  stroke={isSelected ? "#ff9800" : isPinned ? "#4caf50" : "#fff"}
                  strokeWidth={isSelected ? 4 : isPinned ? 3 : 2}
                />
                {/* Pin indicator */}
                {isPinned && (
                  <circle r={5} cx={14} cy={-14} fill="#4caf50" stroke="#fff" strokeWidth={1} />
                )}
                <text fontSize="11px" textAnchor="middle" dy={35} fill="#333">
                  {displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {renderNodes.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#999",
            textAlign: "center",
          }}
        >
          アイドルを検索して追加してください
        </div>
      )}
    </div>
  );
}
