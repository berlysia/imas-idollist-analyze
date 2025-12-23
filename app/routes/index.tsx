import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const metadataRaw = await readFile(join(dataDir, "metadata.json"), "utf-8");
  return {
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { metadata } = await loadData();

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
              に掲載されている「このアイドルの担当プロデューサーはこちらのアイドルもお気に入りに設定しています」を分析し、アイドル間の意外な関係をプロデューサーのみなさんの行動から探る試みです。
            </p>
          </ExplanationBox>
          <h3>用語について</h3>
          <ExplanationBox>
            <ul>
              <li>
                <strong>随伴（A→B）</strong>
                ：アイドルAのページにアイドルBが掲載されている関係
              </li>
              <li>
                <strong>相互随伴（A↔B）</strong>：AとBが互いのページに掲載されている関係
              </li>
              <li>
                <strong>共起（B‖C｜A）</strong>：アイドルAのページにBとCが同時に掲載されている関係
              </li>
              <li>
                <strong>共起元</strong>：アイドルAのページにBとCが同時に掲載されているとき、BCのペアから見たA
              </li>
            </ul>
          </ExplanationBox>
        </div>
      </main>
      <PageFooter />
    </>,
    { title: SITE_TITLE }
  );
});
