import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../lib/constants";
import { GraphSvgContainer, GraphLegend, LegendNode } from "../components/shared";

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

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  brand: Brand[];
  coreness: number;
  role: "core" | "peripheral";
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
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

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Filter out hidden nodes
    const visibleMembers = cluster.memberRoles.filter((m) => !hiddenIds.has(m.id));

    const nodes: GraphNode[] = visibleMembers.map((m) => ({
      id: m.id,
      name: m.name,
      brand: m.brand,
      coreness: m.coreness,
      role: m.role,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Filter edges where both source and target are visible
    const links: GraphLink[] = cluster.edges
      .filter(
        (e) =>
          nodeMap.has(e.source) &&
          nodeMap.has(e.target) &&
          !hiddenIds.has(e.source) &&
          !hiddenIds.has(e.target)
      )
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        weight: e.weight,
        directionality: e.directionality,
      }));

    const maxWeight = Math.max(...links.map((l) => l.weight), 1);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 120 - (d.weight / maxWeight) * 30)
          .strength((d) => 0.3 + (d.weight / maxWeight) * 0.4)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(45));

    const g = svg.append("g");

    // Define arrow markers
    const defs = svg.append("defs");

    // Arrow for unidirectional edges (gray)
    defs
      .append("marker")
      .attr("id", "arrow-uni")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

    // Arrow for bidirectional edges (blue) - end
    defs
      .append("marker")
      .attr("id", "arrow-bi-end")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#1976d2");

    // Arrow for bidirectional edges (blue) - start
    defs
      .append("marker")
      .attr("id", "arrow-bi-start")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", -10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M10,-5L0,0L10,5")
      .attr("fill", "#1976d2");

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => (d.directionality === 2 ? "#1976d2" : "#999"))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => 1 + (d.weight / maxWeight) * 4)
      .attr("marker-end", (d) =>
        d.directionality === 2 ? "url(#arrow-bi-end)" : "url(#arrow-uni)"
      )
      .attr("marker-start", (d) => (d.directionality === 2 ? "url(#arrow-bi-start)" : "none"));

    // Edge weight labels
    const linkLabels = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "#666")
      .attr("text-anchor", "middle")
      .attr("dy", -3)
      .text((d) => d.weight.toFixed(1));

    const dragBehavior = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .call(dragBehavior);

    node
      .append("circle")
      .attr("r", (d) => 8 + d.coreness * 12)
      .attr("fill", (d) => BRAND_COLORS[d.brand[0] ?? "imas"])
      .attr("stroke", (d) => (coreSet.has(d.id) ? "#1976d2" : "#fff"))
      .attr("stroke-width", (d) => (coreSet.has(d.id) ? 3 : 1.5));

    node
      .filter((d) => coreSet.has(d.id))
      .append("circle")
      .attr("r", (d) => 8 + d.coreness * 12 + 5)
      .attr("fill", "none")
      .attr("stroke", "#1976d2")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,2");

    node
      .append("text")
      .text((d) => d.name.split(" ").pop() ?? d.name)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => 8 + d.coreness * 12 + 12)
      .attr("fill", "#333");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      linkLabels
        .attr("x", (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr(
          "y",
          (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2
        );

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [cluster, width, height, coreSet, hiddenIds]);

  return (
    <GraphSvgContainer svgRef={svgRef} width={width} height={height}>
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
      </GraphLegend>
    </GraphSvgContainer>
  );
}
