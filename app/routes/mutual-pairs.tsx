import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { PairCooccurrence } from "../lib/compute";
import PMIFilter from "../islands/PMIFilter";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface PMIData {
  data: PairCooccurrence[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ pmiPairs: PMIData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [pmiRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "pmi-pairs.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    pmiPairs: JSON.parse(pmiRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { pmiPairs, metadata } = await loadData();
  const pairs = pmiPairs.data;

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/mutual-pairs" />
      <main>
        <div className="chart-container">
          <h3>相互掲載推薦ペア</h3>
          <ExplanationBox>
            <p>
              <strong>相互掲載推薦ペア</strong>
              とは、互いのページに掲載推薦として表示されているアイドルのペアです。
            </p>
            <p>
              PMI（Pointwise Mutual Information）値は、このペアが偶然選ばれた場合に比べて
              どれだけ高い確率で相互掲載推薦になっているかを示します。値が高いほど、全体の傾向に対して「意外性のある関係」です。
            </p>
          </ExplanationBox>
          <PMIFilter pairs={pairs} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `相互掲載推薦ペア - ${SITE_TITLE}` }
  );
});
