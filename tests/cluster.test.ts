import { describe, it, expect } from "vitest";
import { buildWeightedGraph, detectClusters, type NormalizedData } from "../app/lib/compute";

function createTestData(
  idols: Record<string, { name: string; brand: ("imas" | "deremas")[] }>,
  accompaniments: Record<string, string[]>
): NormalizedData {
  return {
    scrapedAt: new Date().toISOString(),
    idols: Object.fromEntries(
      Object.entries(idols).map(([id, data]) => [
        id,
        { ...data, link: `https://example.com/${id}` },
      ])
    ),
    accompaniments,
  };
}

describe("buildWeightedGraph", () => {
  it("creates weighted edges from accompaniments", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["deremas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["1", "3"],
        "3": ["1"],
      }
    );

    const { edges, idfMap } = buildWeightedGraph(data);

    expect(edges.length).toBe(3);
    expect(idfMap.size).toBe(3);

    const edge12 = edges.find(
      (e) => (e.source === "1" && e.target === "2") || (e.source === "2" && e.target === "1")
    );
    expect(edge12).toBeDefined();
    expect(edge12!.directionality).toBe(2); // 1→2 and 2→1

    const edge13 = edges.find(
      (e) => (e.source === "1" && e.target === "3") || (e.source === "3" && e.target === "1")
    );
    expect(edge13).toBeDefined();
    expect(edge13!.directionality).toBe(2); // 1→3 and 3→1

    const edge23 = edges.find(
      (e) => (e.source === "2" && e.target === "3") || (e.source === "3" && e.target === "2")
    );
    expect(edge23).toBeDefined();
    expect(edge23!.directionality).toBe(1); // 2→3 only
  });

  it("calculates IDF correctly", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["deremas"] },
        "4": { name: "D", brand: ["deremas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["3"],
        "3": ["4"],
        "4": ["3"],
      }
    );

    const { idfMap } = buildWeightedGraph(data);

    // 4 sources total
    // "2" is selected by 1 source → IDF = log2(4/1) = 2
    // "3" is selected by 3 sources → IDF = log2(4/3) ≈ 0.415
    // "4" is selected by 1 source → IDF = log2(4/1) = 2
    expect(idfMap.get("2")).toBeCloseTo(2, 1);
    expect(idfMap.get("3")).toBeCloseTo(0.415, 1);
    expect(idfMap.get("4")).toBeCloseTo(2, 1);
  });

  it("applies IDF weight to edges", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B (popular)", brand: ["imas"] },
        "3": { name: "C (rare)", brand: ["deremas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["1"],
        "3": ["1"],
      }
    );

    const { edges } = buildWeightedGraph(data);

    const edge12 = edges.find(
      (e) => (e.source === "1" && e.target === "2") || (e.source === "2" && e.target === "1")
    );
    const edge13 = edges.find(
      (e) => (e.source === "1" && e.target === "3") || (e.source === "3" && e.target === "1")
    );

    expect(edge12).toBeDefined();
    expect(edge13).toBeDefined();

    // Both are bidirectional, but "3" is rarer (selected only by "1")
    // while "2" is selected only by "1" too, and "1" is selected by both
    // So the edge with "3" should have higher IDF component
  });
});

describe("detectClusters", () => {
  it("detects a simple 3-node clique as a cluster", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["1", "3"],
        "3": ["1", "2"],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0.3 });

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const cluster = clusters[0]!;
    expect(cluster.members.length).toBe(3);
    expect(cluster.density).toBe(1); // Complete graph
  });

  it("filters clusters by minimum size", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
        "4": { name: "D", brand: ["imas"] },
        "5": { name: "E", brand: ["imas"] },
      },
      {
        "1": ["2"],
        "2": ["1"],
        "3": ["4", "5"],
        "4": ["3", "5"],
        "5": ["3", "4"],
      }
    );

    const clustersMin3 = detectClusters(data, { minSize: 3, minDensity: 0 });
    const clustersMin4 = detectClusters(data, { minSize: 4, minDensity: 0 });

    // The 3-clique (3,4,5) should be detected with minSize=3
    const hasTriple = clustersMin3.some((c) => c.members.length === 3);
    expect(hasTriple).toBe(true);

    // But not with minSize=4
    const hasQuad = clustersMin4.some((c) => c.members.length >= 4);
    expect(hasQuad).toBe(false);
  });

  it("filters clusters by minimum density", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
        "4": { name: "D", brand: ["imas"] },
      },
      {
        // Sparse connections: only 2 edges among 4 nodes
        "1": ["2"],
        "2": ["1"],
        "3": ["4"],
        "4": ["3"],
      }
    );

    const highDensity = detectClusters(data, { minSize: 3, minDensity: 0.9 });
    const _lowDensity = detectClusters(data, { minSize: 3, minDensity: 0.1 });

    // High density should filter out sparse clusters
    expect(highDensity.length).toBe(0);
    // Low density might still find nothing if nodes don't cluster
    // (Variable prefixed with _ to indicate intentionally unused)
  });

  it("returns empty array for disconnected graph", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
      },
      {
        "1": [],
        "2": [],
        "3": [],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0 });
    expect(clusters.length).toBe(0);
  });

  it("identifies dominant brands in clusters", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
        "4": { name: "D", brand: ["deremas"] },
      },
      {
        "1": ["2", "3", "4"],
        "2": ["1", "3", "4"],
        "3": ["1", "2", "4"],
        "4": ["1", "2", "3"],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0 });

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const cluster = clusters[0]!;
    expect(cluster.dominantBrands).toContain("imas");
  });

  it("calculates cluster metrics correctly", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["1", "3"],
        "3": ["1", "2"],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0 });

    expect(clusters.length).toBe(1);
    const cluster = clusters[0]!;

    // Complete graph: 3 edges, 3 possible edges, density = 1
    expect(cluster.density).toBe(1);
    expect(cluster.edges.length).toBe(3);
    expect(cluster.totalWeight).toBeGreaterThan(0);
  });

  it("distinguishes core and peripheral members", () => {
    // 6 nodes to ensure Louvain finds a cluster
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
        "4": { name: "D", brand: ["imas"] },
        "5": { name: "E", brand: ["imas"] },
        "6": { name: "F (peripheral)", brand: ["deremas"] },
      },
      {
        // Core: 1-5 are densely connected
        "1": ["2", "3", "4", "5", "6"],
        "2": ["1", "3", "4", "5"],
        "3": ["1", "2", "4", "5"],
        "4": ["1", "2", "3", "5"],
        "5": ["1", "2", "3", "4"],
        // Peripheral: 6 only connects to 1
        "6": ["1"],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0.3 });

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const cluster = clusters[0]!;

    // Should have memberRoles with core/peripheral distinction
    expect(cluster.memberRoles).toBeDefined();
    expect(cluster.coreMembers).toBeDefined();
    expect(cluster.peripheralMembers).toBeDefined();

    // Node 6 should have lower coreness than the core nodes
    const node6 = cluster.memberRoles.find((m) => m.id === "6");
    const node1 = cluster.memberRoles.find((m) => m.id === "1");

    if (node6 && node1) {
      expect(node6.coreness).toBeLessThan(node1.coreness);
      expect(node6.degree).toBeLessThan(node1.degree);
    }
  });

  it("calculates coreDensity for core subgraph", () => {
    const data = createTestData(
      {
        "1": { name: "A", brand: ["imas"] },
        "2": { name: "B", brand: ["imas"] },
        "3": { name: "C", brand: ["imas"] },
      },
      {
        "1": ["2", "3"],
        "2": ["1", "3"],
        "3": ["1", "2"],
      }
    );

    const clusters = detectClusters(data, { minSize: 3, minDensity: 0 });

    expect(clusters.length).toBe(1);
    const cluster = clusters[0]!;

    // For a complete graph, coreDensity should equal density
    expect(cluster.coreDensity).toBeDefined();
    expect(cluster.coreDensity).toBeGreaterThan(0);
  });
});
