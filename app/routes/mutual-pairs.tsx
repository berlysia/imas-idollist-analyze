import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { PairCooccurrence, Cluster, CrossBrandCluster } from "../lib/compute";
import PMIFilter from "../islands/PMIFilter";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface PMIData {
  data: PairCooccurrence[];
}

interface ClustersData {
  data: Cluster[];
}

interface CrossBrandClustersData {
  data: CrossBrandCluster[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

interface ClusterInfo {
  clusterId: number;
  clusterIndex: number;
}

function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

function buildPairToClusterMap(clusters: Cluster[]): Record<string, ClusterInfo> {
  const map: Record<string, ClusterInfo> = {};
  clusters.forEach((cluster, clusterIndex) => {
    for (const edge of cluster.edges) {
      const pairKey = makePairKey(edge.source, edge.target);
      map[pairKey] = { clusterId: cluster.id, clusterIndex };
    }
  });
  return map;
}

function buildCrossBrandPairToClusterMap(
  clusters: CrossBrandCluster[]
): Record<string, ClusterInfo> {
  const map: Record<string, ClusterInfo> = {};
  clusters.forEach((cluster, clusterIndex) => {
    for (const edge of cluster.edges) {
      const pairKey = makePairKey(edge.idolA.id, edge.idolB.id);
      map[pairKey] = { clusterId: cluster.id, clusterIndex };
    }
  });
  return map;
}

async function loadData(): Promise<{
  pmiPairs: PMIData;
  clusters: ClustersData;
  crossBrandClusters: CrossBrandClustersData;
  metadata: MetadataData;
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [pmiRaw, clustersRaw, crossBrandClustersRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "pmi-pairs.json"), "utf-8"),
    readFile(join(dataDir, "clusters.json"), "utf-8"),
    readFile(join(dataDir, "cross-brand-clusters.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    pmiPairs: JSON.parse(pmiRaw),
    clusters: JSON.parse(clustersRaw),
    crossBrandClusters: JSON.parse(crossBrandClustersRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { pmiPairs, clusters, crossBrandClusters, metadata } = await loadData();
  const pairs = pmiPairs.data;
  const pairToCluster = buildPairToClusterMap(clusters.data);
  const crossBrandPairToCluster = buildCrossBrandPairToClusterMap(crossBrandClusters.data);

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/mutual-pairs" />
      <main>
        <div className="chart-container">
          <h3>相互随伴ペア</h3>
          <ExplanationBox>
            <p>
              <strong>相互随伴ペア</strong>
              とは、互いのページに随伴として表示されているアイドルのペアです。
            </p>
            <p>
              PMI（Pointwise Mutual
              Information）値は、このペアが出現する可能性がどれだけ珍しいか、意味を伴っているかを示します。値が高いほど、全体の傾向に対して特徴的な関係です。
            </p>
            <p>
              とくにこの分析ではユニット等の文脈を全く参照していないので、ユニットメンバーや血縁関係などを反映しているように見える場合は、実際にプロデューサーたちの行動からそれが読み取れることを示しています。
            </p>
          </ExplanationBox>
          <PMIFilter
            pairs={pairs}
            pairToCluster={pairToCluster}
            crossBrandPairToCluster={crossBrandPairToCluster}
          />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `相互随伴ペア - ${SITE_TITLE}` }
  );
});
