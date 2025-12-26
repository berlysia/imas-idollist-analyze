import type { Idol, Brand, ScrapeResult } from "../../app/types/index.ts";
import { chromium, type Page } from "playwright";

const SEARCH_URL = "https://idollist.idolmaster-official.jp/search";

/**
 * 一覧ページからアイドル情報を抽出
 */
async function extractIdolsFromPage(page: Page): Promise<Idol[]> {
  return page.evaluate(() => {
    const container = document.querySelector("#app ul.character");
    if (!container) {
      return [];
    }

    const items = container.querySelectorAll("li");
    return Array.from(items).map((li) => {
      const anchor = li.querySelector("a");
      const paragraph = li.querySelector("p");

      // ブランドはCSSクラスから抽出（shadow, cell以外）
      const brand = Array.from(li.classList).filter(
        (cls) => cls !== "shadow" && cls !== "cell"
      ) as Brand[];

      // 読み仮名はspan要素から抽出
      const kanaSpan = paragraph?.querySelector("span");
      const kana = kanaSpan?.textContent?.trim();

      if (!kana) {
        console.error(`Kana not found for idol: ${anchor?.href ?? "unknown"}`);
        throw new Error("Kana extraction failed");
      }

      // 名前はテキストノードから抽出
      const textNodes = paragraph
        ? Array.from(paragraph.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => (node as Text).data.trim())
        : [];

      return {
        link: anchor?.href ?? "",
        brand,
        name: textNodes[0] ?? "",
        kana: kana,
      };
    });
  });
}

export async function fetchIdolList(): Promise<ScrapeResult<Idol>> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(SEARCH_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("#app ul.character li");

    const idols = await extractIdolsFromPage(page);

    return {
      scrapedAt: new Date().toISOString(),
      count: idols.length,
      data: idols,
    };
  } finally {
    await browser.close();
  }
}
