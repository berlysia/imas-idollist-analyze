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
  setNodes: React.Dispatch<React.SetStateAction<Map<string, ExplorerNode>>>;
}

export default function GraphExplorerGraph({
  nodes,
  edges,
  width,
  height,
  selectedNodeId,
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

  // Keep edges ref in sync
  edgesRef.current = edges;

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
    // Restart simulation when nodes change
    alphaRef.current = 1;
    // Immediately update render state
    setRenderNodes(newSimNodes.map((n) => ({ ...n })));
  }, [nodes, width, height]);

  // Force simulation
  useEffect(() => {
    const k = 120;
    const gravity = 0.1;
    const damping = 0.85;
    const centerX = width / 2;
    const centerY = height / 2;
    let running = true;

    function simulate() {
      if (!running) return;

      const simNodes = simNodesRef.current;
      const currentEdges = edgesRef.current;

      if (simNodes.length === 0) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }

      const alpha = alphaRef.current;
      if (alpha < 0.001) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }
      alphaRef.current *= 0.99;

      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      // Apply forces (mutate simulation nodes directly)
      for (const node of simNodes) {
        if (node.fx !== null && node.fy !== null) continue;
        node.vx *= damping;
        node.vy *= damping;
        node.vx += (centerX - node.x) * gravity * 0.01;
        node.vy += (centerY - node.y) * gravity * 0.01;
      }

      // Repulsion
      for (let i = 0; i < simNodes.length; i++) {
        const nodeI = simNodes[i];
        if (!nodeI) continue;
        for (let j = i + 1; j < simNodes.length; j++) {
          const nodeJ = simNodes[j];
          if (!nodeJ) continue;
          const dx = nodeJ.x - nodeI.x;
          const dy = nodeJ.y - nodeI.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = ((k * k) / (dist * dist)) * alpha;
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

      // Update positions
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
        node.x = Math.max(30, Math.min(width - 30, node.x));
        node.y = Math.max(30, Math.min(height - 30, node.y));
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
  }, [width, height]);

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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragNodeId || !svgRef.current) return;

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      // Update simulation nodes directly
      const node = simNodesRef.current.find((n) => n.id === dragNodeId);
      if (node) {
        node.x = x;
        node.y = y;
        node.fx = x;
        node.fy = y;
        setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
      }
    },
    [isDragging, dragNodeId, transform]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragNodeId(null);
  }, []);

  // Wheel zoom - must use non-passive listener for preventDefault to work
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.3, Math.min(3, prev.scale * scaleFactor)),
      }));
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? "grabbing" : "default",
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
          <marker
            id="explorer-arrow-bi-end"
            viewBox="0 -5 10 10"
            refX={25}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#1976d2" />
          </marker>
          <marker
            id="explorer-arrow-bi-start"
            viewBox="0 -5 10 10"
            refX={-15}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M10,-5L0,0L10,5" fill="#1976d2" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={edge.isMutual ? "#1976d2" : "#999"}
                strokeOpacity={0.6}
                strokeWidth={1 + edge.weight * 3}
                markerEnd={
                  edge.isMutual ? "url(#explorer-arrow-bi-end)" : "url(#explorer-arrow-uni)"
                }
                markerStart={edge.isMutual ? "url(#explorer-arrow-bi-start)" : undefined}
              />
            );
          })}

          {/* Nodes */}
          {renderNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
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
                  stroke={isSelected ? "#ff9800" : "#fff"}
                  strokeWidth={isSelected ? 4 : 2}
                />
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
