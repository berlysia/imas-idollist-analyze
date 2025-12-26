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
  | "gakuen" // 学園アイドルマスター
  | "other"; // その他

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
  /** 読み仮名（ひらがな） */
  kana: string;
}

/**
 * 詳細ページから取得する随伴アイドル情報
 */
export interface IdolDetail extends Idol {
  /** 随伴アイドルID一覧（このアイドルのページに掲載されているアイドルのID） */
  accompanying: string[];
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
 * 随伴データの統計情報
 */
export interface AccompanimentStats {
  /** アイドルID（linkから抽出） */
  idolId: string;
  /** アイドル名 */
  name: string;
  /** ブランド */
  brand: Brand[];
  /** 随伴アイドル数 */
  accompanimentCount: number;
  /** ブランド別随伴数 */
  accompanimentByBrand: Record<Brand, number>;
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
 * 可視化用のエッジ（随伴関係）
 */
export interface ChartEdge {
  source: string;
  target: string;
  weight: number;
}
