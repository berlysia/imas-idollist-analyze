import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandCluster } from "../lib/compute";
import CrossBrandClusterList from "../islands/CrossBrandClusterList";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";

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
        <div className="chart-container">
          <h3>共選クラスタ</h3>
          <ExplanationBox>
            <p>
              <strong>共選クラスタ</strong>
              とは、異なるブランドのアイドル同士が共起として選ばれているグループです。
            </p>
            <p>
              ブランド横断ペア（異なるブランドのアイドルが同時に共起に選ばれている）のみを
              エッジとしてLouvain法でコミュニティ検出を行っています。
            </p>
          </ExplanationBox>
          <CrossBrandClusterList clusters={clusters.data} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: "共選クラスタ - アイドルマスター アイドル名鑑 共起関係可視化" }
  );
});
