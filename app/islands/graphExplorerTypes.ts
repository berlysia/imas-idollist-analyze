import type { Brand } from "@/types";

export interface IdolListItem {
  id: string;
  name: string;
  brand: Brand[];
  kana: string;
}

export interface ExplorerNode {
  id: string;
  name: string;
  brand: Brand[];
  x?: number | undefined;
  y?: number | undefined;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

export interface ExplorerEdge {
  source: string;
  target: string;
  isMutual: boolean;
  weight: number;
  pmi?: number;
  cooccurrenceSourceCount?: number;
  /** 類似アイドル用: 共通随伴アイドルの数 */
  commonAccompanimentCount?: number;
  /** 類似アイドル用: レアスコア */
  rareScore?: number;
  edgeType: EdgeType;
}

export type EdgeType = "accompaniment" | "cooccurrenceCompanion" | "similarByAccompaniment";

export interface EdgeVisibility {
  accompaniment: boolean;
  cooccurrenceCompanion: boolean;
  similarByAccompaniment: boolean;
}

export interface CooccurrenceCompanionPairData {
  idolA: { id: string; name: string; brand: Brand[] };
  idolB: { id: string; name: string; brand: Brand[] };
  cooccurrenceSourceCount: number;
  cooccurrenceSources: Array<{ id: string; name: string; brand: Brand[] }>;
  pmi: number;
}

export interface SimilarByAccompanimentPairData {
  idolA: { id: string; name: string; brand: Brand[] };
  idolB: { id: string; name: string; brand: Brand[] };
  commonAccompanimentCount: number;
  rareScore: number;
  commonAccompaniments: Array<{ id: string; name: string; brand: Brand[]; idf: number }>;
}
