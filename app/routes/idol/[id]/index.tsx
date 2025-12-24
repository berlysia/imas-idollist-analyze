import { createRoute } from "honox/factory";
import { ssgParams } from "hono/ssg";
import { readFile } from "fs/promises";
import { join } from "path";
import type { IdolDetail } from "../../../lib/compute";
import { BRAND_NAMES, SITE_TITLE } from "../../../lib/constants";
import type { Brand } from "@/types";
import { BrandDot, NavigationTabs, PageFooter, PageHeader } from "../../../components/shared";
import SimilarIdolsFilter from "../../../islands/SimilarIdolsFilter";
import { ScoreBadge } from "../../../components/shared";

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

async function loadMetadata(): Promise<{
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const raw = await readFile(join(dataDir, "metadata.json"), "utf-8");
  return JSON.parse(raw);
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
        <PageHeader metadata={metadata} />
        <NavigationTabs activeTab="/idol-list" />

        <main>
          <div className="idol-detail">
            <div className="idol-header">
              {detail.brand.map((b) => (
                <BrandDot key={b} brand={b} size="large" />
              ))}
              <h2>{detail.name}</h2>
              <div>{detail.kana}</div>
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
              <h3>随伴アイドル</h3>
              <p className="section-description">
                このアイドルのページに随伴として表示されているアイドル
              </p>
              {detail.selectedIdols.length > 0 ? (
                (() => {
                  // 共起随伴ペアのPMI情報をマップ化
                  const crossBrandPmiMap = new Map(
                    detail.cooccurrenceCompanionPairs.map((b) => [b.partner.id, b.pmi])
                  );
                  // PMI ≥ 3.0 を高PMIとする（期待の8倍以上の頻度で共起 = 強い関連性）
                  const HIGH_PMI_THRESHOLD = 3.0;

                  return (
                    <ul className="idol-list compact">
                      {detail.selectedIdols.map((idol) => {
                        const crossBrandPmi = crossBrandPmiMap.get(idol.id);
                        const isHighPmi =
                          crossBrandPmi !== undefined && crossBrandPmi >= HIGH_PMI_THRESHOLD;
                        return (
                          <li
                            key={idol.id}
                            style={
                              isHighPmi
                                ? {
                                    background: "#fffbeb",
                                    border: "2px solid #d4a017",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    boxShadow: "0 2px 8px rgba(212, 160, 23, 0.2)",
                                  }
                                : crossBrandPmi !== undefined
                                  ? {
                                      background: "#f9f0ff",
                                      borderLeft: "3px solid #8e44ad",
                                      paddingLeft: "8px",
                                    }
                                  : undefined
                            }
                          >
                            <a href={`/idol/${idol.id}`} className="idol-link">
                              {idol.brand.map((b) => (
                                <BrandDot key={b} brand={b} size="small" />
                              ))}
                              {idol.name}
                            </a>
                            <ScoreBadge metric="idf" value={idol.score.idf} />
                            {crossBrandPmi !== undefined && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "12px",
                                  color: isHighPmi ? "#b8860b" : "#8e44ad",
                                  fontWeight: isHighPmi ? "bold" : "normal",
                                }}
                              >
                                {isHighPmi && "★ "}共起随伴PMI: {crossBrandPmi}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()
              ) : (
                <p className="empty-message">随伴データなし</p>
              )}
            </div>

            {detail.mutualPairs.length > 0 && (
              <div className="detail-section">
                <h3>相互随伴アイドル</h3>
                <ul className="idol-list">
                  {detail.mutualPairs.map((idol) => (
                    <li key={idol.id}>
                      <a href={`/idol/${idol.id}`} className="idol-link">
                        {idol.brand.map((b) => (
                          <BrandDot key={b} brand={b} size="small" />
                        ))}
                        {idol.name}
                      </a>
                      <ScoreBadge metric="pmi" value={idol.pmi} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detail-section">
              <h3>随伴元アイドル</h3>
              <p className="section-description">
                このアイドルを随伴として表示しているアイドルの数：{" "}
                <span className="stat-number">{detail.incomingCount}人</span>
              </p>
              <p className="section-description">
                このアイドルを選ぶことの珍しさ{" "}
                <ScoreBadge metric="idf" value={detail.selectedBy[0]?.score.idf ?? 0} />
              </p>

              {Object.values(detail.incomingByBrand).some((count) => count > 0) && (
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
              )}

              {detail.selectedBy.length > 0 && (
                <ul className="idol-list compact">
                  {detail.selectedBy.map((idol) => (
                    <li key={idol.id}>
                      <a href={`/idol/${idol.id}`} className="idol-link">
                        {idol.brand.map((b) => (
                          <BrandDot key={b} brand={b} size="small" />
                        ))}
                        {idol.name}
                      </a>
                      {idol.score.rank !== undefined && (
                        <ScoreBadge metric="rank" value={idol.score.rank} suffix="/6位" />
                      )}
                      {idol.score.idfDeviation !== undefined && (
                        <ScoreBadge metric="idf-deviation" value={idol.score.idfDeviation} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detail.cooccurrenceCompanionPairs.length > 0 && (
              <div className="detail-section">
                <h3>共起随伴ペア</h3>
                <p className="section-description">
                  異なるブランドのアイドルと一緒に随伴として表示されているペア
                </p>
                <ul className="bridge-list">
                  {detail.cooccurrenceCompanionPairs.slice(0, 10).map((bridge) => (
                    <li key={bridge.partner.id}>
                      <div className="bridge-header">
                        <a href={`/idol/${bridge.partner.id}`} className="idol-link">
                          {bridge.partner.brand.map((b) => (
                            <BrandDot key={b} brand={b} size="small" />
                          ))}
                          {bridge.partner.name}
                        </a>
                        <span className="voter-badge">
                          {bridge.cooccurrenceSourceCount}人が同時選出
                        </span>
                        <ScoreBadge metric="pmi" value={bridge.pmi} />
                      </div>
                      <p className="bridge-voters">
                        共起元:{" "}
                        {bridge.cooccurrenceSources.slice(0, 5).map((source, i) => (
                          <span key={source.id}>
                            {i > 0 && ", "}
                            <a href={`/idol/${source.id}`} className="idol-link">
                              {source.brand.map((b) => (
                                <BrandDot key={b} brand={b} size="small" />
                              ))}
                              {source.name}
                            </a>
                          </span>
                        ))}
                        {bridge.cooccurrenceSources.length > 5 &&
                          ` 他${bridge.cooccurrenceSources.length - 5}人`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(detail.similarIdolGroups?.length ?? 0) > 0 && (
              <SimilarIdolsFilter
                groups={detail.similarIdolGroups ?? []}
                selectedIdols={detail.selectedIdols}
              />
            )}
          </div>
        </main>
        <PageFooter />
      </>,
      { title: `${detail.name} - ${SITE_TITLE}` }
    );
  }
);
