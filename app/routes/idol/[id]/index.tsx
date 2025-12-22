import { createRoute } from "honox/factory";
import { ssgParams } from "hono/ssg";
import { readFile } from "fs/promises";
import { join } from "path";
import type { IdolDetail } from "../../../lib/compute";
import { BRAND_COLORS, BRAND_NAMES } from "../../../lib/constants";
import type { Brand } from "@/types";

async function loadIdolIds(): Promise<string[]> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const raw = await readFile(join(dataDir, "idol-ids.json"), "utf-8");
  return JSON.parse(raw);
}

async function loadIdolDetail(id: string): Promise<IdolDetail | null> {
  try {
    const dataDir = join(process.cwd(), "data/precomputed/idols");
    const raw = await readFile(join(dataDir, `${id}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadMetadata(): Promise<{ scrapedAt: string; idolCount: number }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const raw = await readFile(join(dataDir, "metadata.json"), "utf-8");
  return JSON.parse(raw);
}

function BrandDot({
  brand,
  size = "normal",
}: {
  brand: Brand;
  size?: "normal" | "large" | "small";
}) {
  const sizes = { small: "8px", normal: "12px", large: "20px" };
  return (
    <span
      className={`brand-dot ${size}`}
      style={{ backgroundColor: BRAND_COLORS[brand], width: sizes[size], height: sizes[size] }}
      title={BRAND_NAMES[brand]}
    />
  );
}

export default createRoute(
  ssgParams(async () => {
    const ids = await loadIdolIds();
    return ids.map((id) => ({ id }));
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const [detail, metadata] = await Promise.all([loadIdolDetail(id), loadMetadata()]);

    if (!detail) {
      return c.render(
        <div style={{ textAlign: "center", padding: "40px" }}>
          <h1>アイドルが見つかりません</h1>
          <p>ID: {id}</p>
          <p style={{ marginTop: "20px" }}>
            <a href="/" style={{ color: "#2681c8" }}>
              トップページに戻る
            </a>
          </p>
        </div>,
        { title: "アイドルが見つかりません" }
      );
    }

    return c.render(
      <>
        <header>
          <h1>アイドルマスター 共起関係可視化</h1>
          <p className="metadata">
            データ取得日: {new Date(metadata.scrapedAt).toLocaleDateString("ja-JP")} /{" "}
            {metadata.idolCount}人のアイドル
          </p>
        </header>

        <main>
          <div className="idol-detail">
            <a href="/" className="back-button">
              ← 一覧に戻る
            </a>

            <div className="idol-header">
              <h2>
                {detail.brand.map((b) => (
                  <BrandDot key={b} brand={b} size="large" />
                ))}
                {detail.name}
              </h2>
              <p className="brand-info">{detail.brand.map((b) => BRAND_NAMES[b]).join(", ")}</p>
              <a
                href={detail.link}
                target="_blank"
                rel="noopener noreferrer"
                className="official-link"
              >
                公式IDOL LISTで見る →
              </a>
            </div>

            <div className="detail-section">
              <h3>被共起数</h3>
              <p className="section-description">このアイドルを共起として選んだアイドルの数</p>
              <p className="stat-number">{detail.incomingCount}人</p>
              <div className="brand-breakdown">
                {(Object.entries(detail.incomingByBrand) as [Brand, number][])
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([brand, count]) => (
                    <span key={brand} className={`brand-tag brand-${brand}`}>
                      {BRAND_NAMES[brand]}: {count}
                    </span>
                  ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>選んだ共起アイドル</h3>
              <p className="section-description">このアイドルが共起として選んだアイドル</p>
              {detail.selectedIdols.length > 0 ? (
                <ul className="idol-list compact">
                  {detail.selectedIdols.map((idol) => (
                    <li key={idol.id}>
                      <a href={`/idol/${idol.id}`} className="idol-link">
                        {idol.brand.map((b) => (
                          <BrandDot key={b} brand={b} size="small" />
                        ))}
                        {idol.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-message">共起データなし</p>
              )}
            </div>

            <div className="detail-section">
              <h3>選んでくれたアイドル</h3>
              <p className="section-description">このアイドルを共起として選んだアイドル</p>
              {detail.selectedBy.length > 0 ? (
                <ul className="idol-list compact">
                  {detail.selectedBy.map((idol) => (
                    <li key={idol.id}>
                      <a href={`/idol/${idol.id}`} className="idol-link">
                        {idol.brand.map((b) => (
                          <BrandDot key={b} brand={b} size="small" />
                        ))}
                        {idol.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-message">選んでくれたアイドルなし</p>
              )}
            </div>

            {detail.mutualPairs.length > 0 && (
              <div className="detail-section">
                <h3>相思相愛ペア</h3>
                <p className="section-description">互いに共起として選び合っているアイドル</p>
                <ul className="idol-list">
                  {detail.mutualPairs.map((idol) => (
                    <li key={idol.id}>
                      <a href={`/idol/${idol.id}`} className="idol-link">
                        {idol.brand.map((b) => (
                          <BrandDot key={b} brand={b} size="small" />
                        ))}
                        {idol.name}
                      </a>
                      <span className="pmi-badge">PMI: {idol.pmi.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.crossBrandBridges.length > 0 && (
              <div className="detail-section">
                <h3>ブランド横断ペア</h3>
                <p className="section-description">
                  異なるブランドのアイドルと一緒に選ばれているペア
                </p>
                <ul className="bridge-list">
                  {detail.crossBrandBridges.slice(0, 10).map((bridge) => (
                    <li key={bridge.partner.id}>
                      <div className="bridge-header">
                        <a href={`/idol/${bridge.partner.id}`} className="idol-link">
                          {bridge.partner.brand.map((b) => (
                            <BrandDot key={b} brand={b} size="small" />
                          ))}
                          {bridge.partner.name}
                        </a>
                        <span className="voter-badge">{bridge.voterCount}人が同時選択</span>
                        <span className="pmi-badge">PMI: {bridge.pmi.toFixed(2)}</span>
                      </div>
                      <p className="bridge-voters">
                        選んだ人:{" "}
                        {bridge.voters.slice(0, 5).map((voter, i) => (
                          <span key={voter.id}>
                            {i > 0 && ", "}
                            <a href={`/idol/${voter.id}`} className="voter-link">
                              {voter.name}
                            </a>
                          </span>
                        ))}
                        {bridge.voters.length > 5 && ` 他${bridge.voters.length - 5}人`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>

        <footer>
          <p>
            データ出典:{" "}
            <a
              href="https://idollist.idolmaster-official.jp/"
              target="_blank"
              rel="noopener noreferrer"
            >
              アイドルマスター公式 IDOL LIST
            </a>
          </p>
        </footer>
      </>,
      { title: `${detail.name} - アイドルマスター 共起関係可視化` }
    );
  }
);
