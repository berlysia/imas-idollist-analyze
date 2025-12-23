import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CooccurrenceStats } from "../lib/compute";
import RankingChart from "../islands/RankingChart";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "app/lib/constants";

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
      <NavigationTabs activeTab="/incoming-ranking" />
      <main>
        <div className="chart-container">
          <h3>被掲載推薦ランキング</h3>
          <ExplanationBox>
            <p>
              <strong>被掲載推薦ランキング</strong>
              とは、各アイドルがどれだけ多くのアイドルのページに掲載推薦として表示されているかを示すランキングです。
            </p>
          </ExplanationBox>
          <RankingChart stats={stats} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `被掲載推薦ランキング - ${SITE_TITLE}` }
  );
});
