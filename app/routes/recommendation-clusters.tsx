import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { Cluster } from "../lib/compute";
import ClusterList from "../islands/ClusterList";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

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
      <NavigationTabs activeTab="/recommendation-clusters" />
      <main>
        <div className="chart-container">
          <h3>随伴クラスタ</h3>
          <ExplanationBox>
            <p>
              <strong>随伴クラスタ</strong>
              とは、互いのページに随伴として密接に結びついているアイドルのグループです。
            </p>
            <p>
              Louvain法によるコミュニティ検出を使用し、IDF（珍しさ）を考慮した重み付けで
              「珍しい選択で結びついた」クラスタを優先的に発見しています。
            </p>
          </ExplanationBox>
          <ClusterList clusters={clusters.data} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `随伴クラスタ - ${SITE_TITLE}` }
  );
});
