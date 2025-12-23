import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandCluster } from "../lib/compute";
import CrossBrandClusterList from "../islands/CrossBrandClusterList";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface ClustersData {
  data: CrossBrandCluster[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ clusters: ClustersData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [clustersRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "cross-brand-clusters.json"), "utf-8"),
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
      <NavigationTabs activeTab="/co-selection-clusters" variant="crossbrand" />
      <main>
        <CrossBrandClusterList clusters={clusters.data} />
      </main>
      <PageFooter />
    </>,
    { title: "共選クラスタ - アイドルマスター アイドル名鑑 共起関係可視化" }
  );
});
