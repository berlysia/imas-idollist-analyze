import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import GraphExplorer from "../islands/GraphExplorer";
import type { Brand } from "@/types";
import { SITE_TITLE } from "../lib/constants";
import { buildIdfMap, computePMIRanking, type NormalizedData } from "../lib/compute";
import type { CooccurrenceCompanionPairData } from "../islands/graphExplorerTypes";

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
  cooccurrenceCompanionPairs: CooccurrenceCompanionPairData[];
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [metadataRaw, idolListRaw, normalizedRaw, cooccurrenceCompanionRaw] = await Promise.all([
    readFile(join(dataDir, "metadata.json"), "utf-8"),
    readFile(join(dataDir, "idol-list.json"), "utf-8"),
    readFile(join(process.cwd(), "data/normalized.json"), "utf-8"),
    readFile(join(dataDir, "cooccurrence-companion.json"), "utf-8"),
  ]);
  const idolListData = JSON.parse(idolListRaw);
  const normalized: NormalizedData = JSON.parse(normalizedRaw);
  const cooccurrenceCompanionData = JSON.parse(cooccurrenceCompanionRaw);

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
    cooccurrenceCompanionPairs: cooccurrenceCompanionData.data,
  };
}

export default createRoute(async (c) => {
  const { idolList, normalized, idfMap, pmiMap, cooccurrenceCompanionPairs } = await loadData();

  return c.render(
    <div
      data-fullscreen
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* 軽量ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#333",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="/"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            ← 戻る
          </a>
          <span style={{ fontSize: "14px" }}>グラフ探索</span>
        </div>
        <span style={{ fontSize: "11px", color: "#aaa" }}>
          ドラッグでノード移動 / ダブルクリックで固定 / ホイールでズーム
        </span>
      </header>

      {/* フルスクリーングラフ */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        <GraphExplorer
          idolList={idolList}
          accompaniments={normalized.accompaniments}
          idols={normalized.idols}
          idfMap={idfMap}
          pmiMap={pmiMap}
          cooccurrenceCompanionPairs={cooccurrenceCompanionPairs}
        />
      </main>
    </div>,
    { title: `グラフ探索 - ${SITE_TITLE}` }
  );
});
