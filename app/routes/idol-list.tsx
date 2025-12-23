import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { Brand } from "@/types";
import IdolList from "../islands/IdolList";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface IdolListItem {
  id: string;
  name: string;
  brand: Brand[];
  kana: string;
}

interface IdolListData {
  data: IdolListItem[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ idolList: IdolListData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [idolListRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "idol-list.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  const idolList: IdolListData = JSON.parse(idolListRaw);
  idolList.data = idolList.data.map((x: IdolListItem) => ({...x, kana: x.kana?.replaceAll(/\s/g, "")}));
  const metadata: MetadataData = JSON.parse(metadataRaw);
  return {
    idolList,
    metadata,
  };
}

export default createRoute(async (c) => {
  const { idolList, metadata } = await loadData();

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/idol-list" />
      <main>
        <div className="chart-container">
          <h3>アイドル一覧</h3>
          <ExplanationBox>
            <p>
              <strong>アイドル一覧</strong>
              では、全アイドルを一覧表示します。ブランドでの絞り込みや、名前・読み仮名での検索が可能です。
            </p>
          </ExplanationBox>
          <IdolList idols={idolList.data} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `アイドル一覧 - ${SITE_TITLE}` }
  );
});
