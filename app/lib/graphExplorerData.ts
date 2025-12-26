import { readFile } from "fs/promises";
import { join } from "path";
import type { Brand } from "../types";
import { buildIdfMap, computePMIRanking, type NormalizedData } from "./compute.ts";
import type {
  CooccurrenceCompanionPairData,
  SimilarByAccompanimentPairData,
} from "../islands/graphExplorerTypes.ts";

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

export interface GraphExplorerData {
  metadata: MetadataData;
  idolList: IdolListItem[];
  normalized: NormalizedData;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
  cooccurrenceCompanionPairs: CooccurrenceCompanionPairData[];
  similarByAccompanimentPairs: SimilarByAccompanimentPairData[];
}

export async function loadGraphExplorerData(): Promise<GraphExplorerData> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [
    metadataRaw,
    idolListRaw,
    normalizedRaw,
    cooccurrenceCompanionRaw,
    similarByAccompanimentRaw,
  ] = await Promise.all([
    readFile(join(dataDir, "metadata.json"), "utf-8"),
    readFile(join(dataDir, "idol-list.json"), "utf-8"),
    readFile(join(process.cwd(), "data/normalized.json"), "utf-8"),
    readFile(join(dataDir, "cooccurrence-companion.json"), "utf-8"),
    readFile(join(dataDir, "similar-by-accompaniment.json"), "utf-8"),
  ]);
  const idolListData = JSON.parse(idolListRaw);
  const normalized: NormalizedData = JSON.parse(normalizedRaw);
  const cooccurrenceCompanionData = JSON.parse(cooccurrenceCompanionRaw);
  const similarByAccompanimentData = JSON.parse(similarByAccompanimentRaw);

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
    similarByAccompanimentPairs: similarByAccompanimentData.data,
  };
}
