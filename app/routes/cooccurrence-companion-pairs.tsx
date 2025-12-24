import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CooccurrenceCompanionPair, CooccurrenceCompanionCluster } from "../lib/compute";
import BridgesTable from "../islands/BridgesTable";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface BridgesData {
  data: CooccurrenceCompanionPair[];
}

interface ClustersData {
  data: CooccurrenceCompanionCluster[];
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

function buildPairToClusterMap(
  clusters: CooccurrenceCompanionCluster[]
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
  bridges: BridgesData;
  clusters: ClustersData;
  metadata: MetadataData;
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [bridgesRaw, clustersRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "cooccurrence-companion.json"), "utf-8"),
    readFile(join(dataDir, "cooccurrence-companion-clusters.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    bridges: JSON.parse(bridgesRaw),
    clusters: JSON.parse(clustersRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { bridges, clusters, metadata } = await loadData();
  const bridgeList = bridges.data;
  const pairToCluster = buildPairToClusterMap(clusters.data);

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/cooccurrence-companion-pairs" />
      <main>
        <div className="chart-container">
          <h3>共起随伴ペア</h3>
          <ExplanationBox>
            <p>
              <strong>共起随伴ペア</strong>
              とは、異なるブランドのアイドル2人が、複数のアイドルのページに同時に随伴として表示されているペアです。
            </p>
            <p>
              共起元数が多いほど、そのペアのアイドルをセットで「お気に入り」しているアイドルが多いことを示します。
            </p>
            <p>
              PMI（Pointwise Mutual
              Information）値は、このペアが出現する可能性がどれだけ珍しいか、意味を伴っているかを示します。値が高いほど、全体の傾向に対して特徴的な関係です。
            </p>
            <p>ここで、同じ共起随伴ペアをもつ複数のアイドル同士の間には、<strong>共起随伴による類似</strong>の関係があると考えられます。似た構成のアイドルが一緒に「お気に入り」されているということは、直接お気に入りに現れなくとも、何らかの関連性があることを示唆しています。</p>
          </ExplanationBox>
          <BridgesTable bridges={bridgeList} pairToCluster={pairToCluster} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `共起随伴ペア - ${SITE_TITLE}` }
  );
});
