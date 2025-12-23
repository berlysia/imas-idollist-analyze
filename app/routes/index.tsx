import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CooccurrenceStats } from "../lib/compute";
import RankingChart from "../islands/RankingChart";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface RankingData {
  data: CooccurrenceStats[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ ranking: RankingData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [rankingRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "ranking.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    ranking: JSON.parse(rankingRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { ranking, metadata } = await loadData();
  const stats = ranking.data;

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/" />
      <main>
        <RankingChart stats={stats} />
      </main>
      <PageFooter />
    </>,
    { title: "アイドルマスター 共起関係可視化" }
  );
});
