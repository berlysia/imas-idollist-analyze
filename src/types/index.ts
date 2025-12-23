/**
 * アイマスのブランド識別子
 * CSSクラス名から取得される値
 */
export type Brand =
  | "imas" // 765PRO ALLSTARS
  | "deremas" // シンデレラガールズ
  | "milimas" // ミリオンライブ
  | "sidem" // SideM
  | "shiny" // シャイニーカラーズ
  | "gakuen"; // 学園アイドルマスター

/**
 * アイドルの基本情報
 * スクレイピング対象ページから取得する構造
 */
export interface Idol {
  /** 詳細ページへのリンク */
  link: string;
  /** 所属ブランド（複数所属の可能性あり） */
  brand: Brand[];
  /** アイドル名 */
  name: string;
}

/**
 * 詳細ページから取得する掲載推薦アイドル情報
 */
export interface IdolDetail extends Idol {
  /** 掲載推薦アイドル一覧（このアイドルのページに掲載されているアイドル） */
  recommended: Idol[];
}

/**
 * スクレイピング結果のメタデータ
 */
export interface ScrapeResult<T> {
  /** 取得日時 */
  scrapedAt: string;
  /** データ件数 */
  count: number;
  /** 取得データ */
  data: T[];
}

/**
 * 掲載推薦データの統計情報
 */
export interface RecommendationStats {
  /** アイドルID（linkから抽出） */
  idolId: string;
  /** アイドル名 */
  name: string;
  /** ブランド */
  brand: Brand[];
  /** 掲載推薦アイドル数 */
  recommendationCount: number;
  /** ブランド別掲載推薦数 */
  recommendationByBrand: Record<Brand, number>;
}

/**
 * 可視化用のノード（アイドル）
 */
export interface ChartNode {
  id: string;
  name: string;
  brand: Brand[];
  value: number;
}

/**
 * 可視化用のエッジ（掲載推薦関係）
 */
export interface ChartEdge {
  source: string;
  target: string;
  weight: number;
}
