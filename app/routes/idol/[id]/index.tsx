import { createRoute } from "honox/factory";
import { ssgParams } from "hono/ssg";
import { readFile } from "fs/promises";
import { join } from "path";
import type { IdolDetail } from "../../../lib/compute";
import { BRAND_NAMES, SITE_TITLE } from "../../../lib/constants";
import type { Brand } from "@/types";
import { BrandDot, NavigationTabs, PageFooter, PageHeader } from "../../../components/shared";

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

type MetricType = "pmi" | "idf" | "idf-deviation" | "rank";

const METRIC_DESCRIPTIONS: Record<MetricType, { label: string; description: string }> = {
  pmi: {
    label: "PMI",
    description:
      "Pointwise Mutual Information: 二者が一緒に現れる頻度が、独立な場合と比べてどれだけ高いかを示す指標。値が高いほど強い関連性を持つ。",
  },
  idf: {
    label: "IDF",
    description:
      "Inverse Document Frequency: そのアイドルを選ぶことの珍しさを示す指標。多くの人に選ばれているアイドルほど値が低く、珍しい選択ほど値が高い。",
  },
  "idf-deviation": {
    label: "IDF偏差",
    description:
      "選択リスト内での珍しさの偏差。選んだ6人の中でこのアイドルの珍しさが平均からどれだけ離れているかを示す。正の値は平均より珍しい選択。",
  },
  rank: {
    label: "順位",
    description:
      "選択リスト内での珍しさ順位。選んだ6人の中でIDF値が高い順に並べた時の順位。1位が最も珍しい選択。",
  },
};

function ScoreBadge({
  metric,
  value,
  suffix,
}: {
  metric: MetricType;
  value: string | number;
  suffix?: string;
}) {
  const { label, description } = METRIC_DESCRIPTIONS[metric];
  return (
    <span className="score-badge-wrapper">
      <span className="score-badge">
        {label}: {value}
        {suffix ?? ""}
      </span>
      <span className="score-badge-tooltip">{description}</span>
    </span>
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
                  // ブランド横断ペアのPMI情報をマップ化
                  const crossBrandPmiMap = new Map(
                    detail.crossBrandBridges.map((b) => [b.partner.id, b.pmi])
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
                            <ScoreBadge metric="idf" value={idol.score.idf.toFixed(2)} />
                            {crossBrandPmi !== undefined && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "12px",
                                  color: isHighPmi ? "#b8860b" : "#8e44ad",
                                  fontWeight: isHighPmi ? "bold" : "normal",
                                }}
                              >
                                {isHighPmi && "★ "}ブランド横断PMI: {crossBrandPmi.toFixed(2)}
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
                      <ScoreBadge metric="pmi" value={idol.pmi.toFixed(2)} />
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
                <ScoreBadge
                  metric="idf"
                  value={detail.selectedBy[0]?.score.idf.toFixed(2) ?? "-"}
                />
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
                        <ScoreBadge
                          metric="idf-deviation"
                          value={idol.score.idfDeviation.toFixed(2)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detail.crossBrandBridges.length > 0 && (
              <div className="detail-section">
                <h3>ブランド横断ペア</h3>
                <p className="section-description">
                  異なるブランドのアイドルと一緒に随伴として表示されているペア
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
                        <span className="voter-badge">
                          {bridge.cooccurrenceSourceCount}人が同時選出
                        </span>
                        <ScoreBadge metric="pmi" value={bridge.pmi.toFixed(2)} />
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

            {detail.similarIdolGroups && detail.similarIdolGroups.length > 0 && (
              <div className="detail-section">
                <h3>類似アイドル</h3>
                <p className="section-description">
                  同じ随伴アイドルを選んでいる他のアイドル（共通する随伴の構成でグループ化）
                </p>
                <ul className="similar-list">
                  {detail.similarIdolGroups.map((group, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: "12px",
                        backgroundColor: "#fafafa",
                        borderRadius: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginRight: "4px",
                          }}
                        >
                          共通随伴:
                        </span>
                        {group.commonAccompaniments.map((accomp) => (
                          <a
                            key={accomp.id}
                            href={`/idol/${accomp.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 6px",
                              backgroundColor: "#fff",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              textDecoration: "none",
                              color: "inherit",
                              fontSize: "12px",
                            }}
                            title={`IDF: ${accomp.idf.toFixed(2)}`}
                          >
                            {accomp.brand.map((b) => (
                              <BrandDot key={b} brand={b} size="small" />
                            ))}
                            {accomp.name}
                          </a>
                        ))}
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginLeft: "auto",
                          }}
                        >
                          ({group.commonAccompanimentCount}人, IDF平均: {group.avgIdf.toFixed(2)})
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          paddingLeft: "8px",
                          borderLeft: "3px solid #8e44ad",
                        }}
                      >
                        {group.idols.map((idol) => (
                          <a
                            key={idol.id}
                            href={`/idol/${idol.id}`}
                            className="idol-link"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {idol.brand.map((b) => (
                              <BrandDot key={b} brand={b} size="small" />
                            ))}
                            {idol.name}
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
        <PageFooter />
      </>,
      { title: `${detail.name} - ${SITE_TITLE}` }
    );
  }
);
