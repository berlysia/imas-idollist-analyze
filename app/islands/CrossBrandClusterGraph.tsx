import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../lib/constants";
import { GraphSvgContainer, GraphLegend, LegendLine } from "../components/shared";

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
}

interface CrossBrandCluster {
  memberDetails: IdolInfo[];
  edges: CrossBrandEdge[];
}

interface Props {
  cluster: CrossBrandCluster;
  width?: number;
  height?: number;
  hiddenIds?: Set<string>;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  brand: Brand[];
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  voterCount: number;
  pmi: number;
}

export default function CrossBrandClusterGraph({
  cluster,
  width = 700,
  height = 500,
  hiddenIds = new Set(),
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const visibleMembers = cluster.memberDetails.filter((m) => !hiddenIds.has(m.id));

    const nodes: GraphNode[] = visibleMembers.map((m) => ({
      id: m.id,
      name: m.name,
      brand: m.brand,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = cluster.edges
      .filter(
        (e) =>
          nodeMap.has(e.idolA.id) &&
          nodeMap.has(e.idolB.id) &&
          !hiddenIds.has(e.idolA.id) &&
          !hiddenIds.has(e.idolB.id)
      )
      .map((e) => ({
        source: nodeMap.get(e.idolA.id)!,
        target: nodeMap.get(e.idolB.id)!,
        voterCount: e.voterCount,
        pmi: e.pmi,
      }));

    const maxVoterCount = Math.max(...links.map((l) => l.voterCount), 1);
    const maxPmi = Math.max(...links.map((l) => l.pmi), 1);

    // PMI ≥ 3.0 を高PMIとする（期待の8倍以上の頻度で共起 = 強い関連性）
    const HIGH_PMI_THRESHOLD = 3.0;

    // 正規化した投票数とPMIを組み合わせた重み
    const getWeight = (l: GraphLink) => {
      const normVoter = l.voterCount / maxVoterCount;
      const normPmi = l.pmi / maxPmi;
      return normVoter * 0.6 + normPmi * 0.4;
    };

    const isHighPmi = (l: GraphLink) => l.pmi >= HIGH_PMI_THRESHOLD;

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 150 - getWeight(d) * 50)
          .strength((d) => 0.2 + getWeight(d) * 0.3)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    const g = svg.append("g");

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => (isHighPmi(d) ? "#d4a017" : "#8e44ad"))
      .attr("stroke-opacity", (d) => (isHighPmi(d) ? 0.9 : 0.6))
      .attr("stroke-width", (d) => (isHighPmi(d) ? 3 + getWeight(d) * 5 : 1 + getWeight(d) * 5));

    const linkLabels = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", (d) => (isHighPmi(d) ? "10px" : "9px"))
      .attr("fill", (d) => (isHighPmi(d) ? "#b8860b" : "#666"))
      .attr("font-weight", (d) => (isHighPmi(d) ? "bold" : "normal"))
      .attr("text-anchor", "middle")
      .attr("dy", -3)
      .text((d) => `${isHighPmi(d) ? "★ " : ""}${d.voterCount}票 / PMI:${d.pmi.toFixed(1)}`);

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
      .attr("r", 14)
      .attr("fill", (d) => BRAND_COLORS[d.brand[0] ?? "imas"])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.name.split(" ").pop() ?? d.name)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", 26)
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
  }, [cluster, width, height, hiddenIds]);

  return (
    <GraphSvgContainer svgRef={svgRef} width={width} height={height}>
      <GraphLegend>
        <LegendLine color="#d4a017" width={4} label="PMI≥3.0（強い関連性）" bold icon="★" />
        <LegendLine color="#8e44ad" width={3} label="ブランド横断ペア（太いほど多くの投票者）" />
      </GraphLegend>
    </GraphSvgContainer>
  );
}
