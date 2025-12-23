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
      <NavigationTabs activeTab="/" />
      <main>
        <div className="chart-container">
          <h3>説明</h3>
          <ExplanationBox>
            <p>
              このページは、アイドルマスターシリーズのアイドルが掲載されている
              <a href="https://idollist.idolmaster-official.jp/">アイドル名鑑</a>
              に掲載されている「このアイドルの担当プロデューサーはこちらのアイドルもお気に入りに設定しています」を分析し、各アイドルの関係性を探る試みです。
            </p>
            <h4>用語について</h4>
            <ul>
              <li>
                <strong>掲載推薦関係（A→B）</strong>
                ：アイドルAのページにアイドルBが掲載されている関係
              </li>
              <li>
                <strong>相互掲載推薦（A↔B）</strong>：AとBが互いのページに掲載されている関係
              </li>
              <li>
                <strong>共起（B‖C｜A）</strong>：アイドルAのページにBとCが同時に掲載されている関係
              </li>
              <li>
                <strong>共起元</strong>：共起関係の文脈となるアイドル（上記のA）
              </li>
            </ul>
          </ExplanationBox>
          <RankingChart stats={stats} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: SITE_TITLE }
  );
});
