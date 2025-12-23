import { useEffect, useRef, useState, useCallback } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES, ALL_BRANDS } from "../lib/constants";

interface IdolInfo {
  name: string;
  brand: Brand[];
}

interface NetworkData {
  idols: Record<string, IdolInfo>;
  accompaniments: Record<string, string[]>;
}

interface Props {
  data: NetworkData;
  initialMinConnections?: number;
}

interface Node {
  id: string;
  name: string;
  brand: Brand[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

interface Edge {
  source: string;
  target: string;
}

export default function NetworkGraph({ data, initialMinConnections = 5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>(ALL_BRANDS);
  const [minConnections, setMinConnections] = useState(initialMinConnections);
  const animationRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setCanvasSize({ width: Math.max(400, width - 32), height: 600 });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Build graph data
  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const incomingCounts = new Map<string, number>();
    for (const targetIds of Object.values(data.accompaniments)) {
      for (const targetId of targetIds) {
        incomingCounts.set(targetId, (incomingCounts.get(targetId) ?? 0) + 1);
      }
    }

    const filteredIds = new Set<string>();
    for (const [id, idol] of Object.entries(data.idols)) {
      const count = incomingCounts.get(id) ?? 0;
      const hasBrand = idol.brand.some((b) => selectedBrands.includes(b));
      if (hasBrand && count >= minConnections) {
        filteredIds.add(id);
      }
    }

    for (const id of filteredIds) {
      const idol = data.idols[id];
      if (!idol) continue;
      newNodes.push({
        id,
        name: idol.name,
        brand: idol.brand,
        x: Math.random() * canvasSize.width,
        y: Math.random() * canvasSize.height,
        vx: 0,
        vy: 0,
        connections: incomingCounts.get(id) ?? 0,
      });
    }

    for (const [sourceId, targetIds] of Object.entries(data.accompaniments)) {
      if (!filteredIds.has(sourceId)) continue;
      for (const targetId of targetIds) {
        if (filteredIds.has(targetId) && sourceId < targetId) {
          newEdges.push({ source: sourceId, target: targetId });
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, selectedBrands, minConnections, canvasSize.width, canvasSize.height]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const width = canvasSize.width;
    const height = canvasSize.height;

    function simulate() {
      if (!ctx) return;

      const k = 30;
      const gravity = 0.1;
      const damping = 0.9;
      const centerX = width / 2;
      const centerY = height / 2;

      for (const node of nodes) {
        node.vx *= damping;
        node.vy *= damping;

        node.vx += (centerX - node.x) * gravity * 0.01;
        node.vy += (centerY - node.y) * gravity * 0.01;
      }

      for (let i = 0; i < nodes.length; i++) {
        const nodeI = nodes[i];
        if (!nodeI) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeJ = nodes[j];
          if (!nodeJ) continue;
          const dx = nodeJ.x - nodeI.x;
          const dy = nodeJ.y - nodeI.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (k * k) / dist;
          const fx = (dx / dist) * force * 0.1;
          const fy = (dy / dist) * force * 0.1;
          nodeI.vx -= fx;
          nodeI.vy -= fy;
          nodeJ.vx += fx;
          nodeJ.vy += fy;
        }
      }

      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - k * 2) * 0.05;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      }

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
      ctx.lineWidth = 0.5;
      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }

      for (const node of nodes) {
        const radius = Math.min(3 + node.connections * 0.3, 15);
        const primaryBrand = node.brand[0];
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = primaryBrand ? BRAND_COLORS[primaryBrand] : "#666";
        ctx.fill();
        if (hoveredNode?.id === node.id) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      if (hoveredNode) {
        const node = nodeMap.get(hoveredNode.id);
        if (node) {
          ctx.fillStyle = "#333";
          ctx.font = "12px sans-serif";
          ctx.fillText(node.name, node.x + 10, node.y - 10);
        }
      }

      animationRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [nodes, edges, hoveredNode, canvasSize.width, canvasSize.height]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let found: Node | null = null;
      for (const node of nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        const radius = Math.min(3 + node.connections * 0.3, 15);
        if (dx * dx + dy * dy < radius * radius) {
          found = node;
          break;
        }
      }
      setHoveredNode(found);
    },
    [nodes]
  );

  const handleBrandChange = (brand: Brand, checked: boolean) => {
    setSelectedBrands((prev) => (checked ? [...prev, brand] : prev.filter((b) => b !== brand)));
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <section className="filters">
        <div className="brand-filters">
          <span>ブランド:</span>
          {ALL_BRANDS.map((brand) => (
            <label key={brand} className={`brand-checkbox brand-${brand}`}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={(e) => handleBrandChange(brand, e.target.checked)}
              />
              {BRAND_NAMES[brand]}
            </label>
          ))}
        </div>
        <div className="connection-filter">
          <label>
            最小被随伴数:
            <input
              type="range"
              min={1}
              max={50}
              value={minConnections}
              onChange={(e) => setMinConnections(Number(e.target.value))}
            />
            {minConnections}
          </label>
        </div>
      </section>

      <p className="graph-info">
        ノード数: {nodes.length} / エッジ数: {edges.length}
      </p>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        style={{
          border: "1px solid #ddd",
          cursor: hoveredNode ? "pointer" : "default",
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
