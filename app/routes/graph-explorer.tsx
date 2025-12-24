import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import GraphExplorer from "../islands/GraphExplorer";
import type { Brand } from "@/types";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";
import { buildIdfMap, computePMIRanking, type NormalizedData } from "../lib/compute";

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

export interface IdolListItem {
  id: string;
  name: string;
  brand: Brand[];
  kana: string;
}

async function loadData(): Promise<{
  metadata: MetadataData;
  idolList: IdolListItem[];
  normalized: NormalizedData;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [metadataRaw, idolListRaw, normalizedRaw] = await Promise.all([
    readFile(join(dataDir, "metadata.json"), "utf-8"),
    readFile(join(dataDir, "idol-list.json"), "utf-8"),
    readFile(join(process.cwd(), "data/normalized.json"), "utf-8"),
  ]);
  const idolListData = JSON.parse(idolListRaw);
  const normalized: NormalizedData = JSON.parse(normalizedRaw);

  // IDF計算: 各アイドルを選ぶことの珍しさ
  const idfMapInternal = buildIdfMap(normalized);
  const idfMap: Record<string, number> = {};
  for (const [id, idf] of idfMapInternal.entries()) {
    idfMap[id] = idf;
  }

  // PMI計算: ペア間の意外性（相互随伴のペアのみ）
  const pmiPairs = computePMIRanking(normalized, 1);
  const pmiMap: Record<string, number> = {};
  for (const pair of pmiPairs) {
    // ペアキー: 小さいID|大きいID
    const key =
      pair.idolA.id < pair.idolB.id
        ? `${pair.idolA.id}|${pair.idolB.id}`
        : `${pair.idolB.id}|${pair.idolA.id}`;
    pmiMap[key] = pair.pmi;
  }

  return {
    metadata: JSON.parse(metadataRaw),
    idolList: idolListData.data,
    normalized,
    idfMap,
    pmiMap,
  };
}

export default createRoute(async (c) => {
  const { metadata, idolList, normalized, idfMap, pmiMap } = await loadData();

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
            idfMap={idfMap}
            pmiMap={pmiMap}
          />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `グラフ探索 - ${SITE_TITLE}` }
  );
});
