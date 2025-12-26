import type { Brand, Idol, ScrapeResult, IdolDetail } from "../../app/types/index.ts";

/**
 * 正規化されたアイドル情報
 */
export interface NormalizedIdol {
  name: string;
  brand: Brand[];
  link: string;
  kana: string;
}

/**
 * 正規化された随伴データ
 */
export interface NormalizedData {
  scrapedAt: string;
  idols: Record<string, NormalizedIdol>;
  /** 随伴関係: キーのアイドルのページに掲載されているアイドルIDの配列 */
  accompaniments: Record<string, string[]>;
}

/**
 * リンクURLからIDを抽出
 * 例: "https://idollist.idolmaster-official.jp/search/detail/10001" -> "10001"
 */
function extractIdFromLink(link: string): string {
  const match = link.match(/\/(\d+)$/);
  if (!match || match[1] === undefined) {
    throw new Error(`Invalid link format: ${link}`);
  }
  return match[1];
}

/**
 * 詳細データを正規化された形式に変換
 * @param data 詳細データ
 * @param idolList 一覧データ（アイドル情報補完用）
 */
export function normalizeDetails(
  data: ScrapeResult<IdolDetail>,
  idolList: ScrapeResult<Idol>
): NormalizedData {
  // idolListからID→アイドル情報のマップを作成
  const idolMap = new Map<string, Idol>();
  for (const idol of idolList.data) {
    const id = extractIdFromLink(idol.link);
    idolMap.set(id, idol);
  }

  const idols: Record<string, NormalizedIdol> = {};
  const accompaniments: Record<string, string[]> = {};

  for (const detail of data.data) {
    const id = extractIdFromLink(detail.link);
    const listIdol = idolMap.get(id);

    idols[id] = {
      name: detail.name,
      brand: detail.brand,
      link: detail.link,
      kana: detail.kana ?? listIdol?.kana,
    };

    // accompanyingは既にIDの配列
    accompaniments[id] = detail.accompanying;

    // 随伴アイドルの情報もidolsに追加（まだ存在しない場合）
    for (const accompanyingId of detail.accompanying) {
      if (!idols[accompanyingId]) {
        const accompanyingIdol = idolMap.get(accompanyingId);
        if (accompanyingIdol) {
          idols[accompanyingId] = {
            name: accompanyingIdol.name,
            brand: accompanyingIdol.brand,
            link: accompanyingIdol.link,
            kana: accompanyingIdol.kana,
          };
        }
      }
    }
  }

  return {
    scrapedAt: data.scrapedAt,
    idols,
    accompaniments,
  };
}
