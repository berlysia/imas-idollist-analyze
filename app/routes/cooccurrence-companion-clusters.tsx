import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CooccurrenceCompanionCluster } from "../lib/compute";
import CooccurrenceCompanionClusterList from "../islands/CooccurrenceCompanionClusterList";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface ClustersData {
  data: CooccurrenceCompanionCluster[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ clusters: ClustersData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [clustersRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "cooccurrence-companion-clusters.json"), "utf-8"),
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
      <NavigationTabs activeTab="/cooccurrence-companion-clusters" variant="cooccurrence" />
      <main>
        <div className="chart-container">
          <h3>共起随伴クラスタ</h3>
          <ExplanationBox>
            <p>
              <strong>共起随伴クラスタ</strong>
              とは、異なるブランドのアイドル同士が同時に随伴として選ばれている（共起している）グループです。
            </p>
            <p>
              共起随伴ペア（異なるブランドのアイドルが共起元のページに同時に掲載されている）のみを
              エッジとしてLouvain法でコミュニティ検出を行っています。
            </p>
          </ExplanationBox>
          <CooccurrenceCompanionClusterList clusters={clusters.data} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `共起随伴クラスタ - ${SITE_TITLE}` }
  );
});
