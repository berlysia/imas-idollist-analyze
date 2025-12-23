import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { Cluster } from "../lib/compute";
import ClusterList from "../islands/ClusterList";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface ClustersData {
  data: Cluster[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ clusters: ClustersData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [clustersRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "clusters.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    clusters: JSON.parse(clustersRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { clusters, metadata } = await loadData();

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/cooccurrence-clusters" />
      <main>
        <ClusterList clusters={clusters.data} />
      </main>
      <PageFooter />
    </>,
    { title: "共起クラスタ - アイドルマスター アイドル名鑑 共起関係可視化" }
  );
});
