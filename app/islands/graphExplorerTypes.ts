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
}
