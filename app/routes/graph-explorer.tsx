import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import GraphExplorer from "../islands/GraphExplorer";
import type { Brand } from "@/types";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

export interface IdolListItem {
  id: string;
  name: string;
  brand: Brand[];
  kana?: string;
}

interface NormalizedData {
  idols: Record<string, { name: string; brand: Brand[]; kana?: string }>;
  accompaniments: Record<string, string[]>;
}

async function loadData(): Promise<{
  metadata: MetadataData;
  idolList: IdolListItem[];
  normalized: NormalizedData;
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [metadataRaw, idolListRaw, normalizedRaw] = await Promise.all([
    readFile(join(dataDir, "metadata.json"), "utf-8"),
    readFile(join(dataDir, "idol-list.json"), "utf-8"),
    readFile(join(process.cwd(), "data/normalized.json"), "utf-8"),
  ]);
  const idolListData = JSON.parse(idolListRaw);
  return {
    metadata: JSON.parse(metadataRaw),
    idolList: idolListData.data,
    normalized: JSON.parse(normalizedRaw),
  };
}

export default createRoute(async (c) => {
  const { metadata, idolList, normalized } = await loadData();

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/graph-explorer" />
      <main>
        <div className="chart-container">
          <h3>グラフ探索</h3>
          <ExplanationBox>
            <p>
              <strong>インタラクティブグラフ探索</strong>:
              アイドルを検索して追加し、随伴関係を探索できます。
              ノードをクリックして随伴アイドルを追加してください。
            </p>
          </ExplanationBox>
          <GraphExplorer
            idolList={idolList}
            accompaniments={normalized.accompaniments}
            idols={normalized.idols}
          />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `グラフ探索 - ${SITE_TITLE}` }
  );
});
