/**
 * 前処理スクリプト
 * 1. 生データを正規化
 * 2. 各種ランキング・統計を事前計算
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeDetails } from "./normalizeDetails.ts";
import {
  computeIncomingStats,
  computePMIRanking,
  computeCooccurrenceCompanionPairs,
  computeIdolDetail,
  detectClusters,
  detectCooccurrenceCompanionClusters,
  computeSimilarIdolGroups,
  computeSimilarByAccompanimentPairs,
  buildIdfMap,
} from "../../app/lib/compute.ts";

const RAW_DATA_DIR = path.resolve(import.meta.dirname, "../../data/raw");
const DATA_DIR = path.resolve(import.meta.dirname, "../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "precomputed");
const IDOLS_DIR = path.join(OUTPUT_DIR, "idols");

const IDOLS_FILE = "idols.json";
const DETAILS_FILE = "details.json";
const NORMALIZED_FILE = "normalized.json";

async function run(): Promise<void> {
  console.log("🚀 Starting preprocessing...");

  // ========================
  // Phase 1: Normalize
  // ========================
  console.log("\n📋 Phase 1: Normalizing raw data...");

  const detailsPath = path.join(RAW_DATA_DIR, DETAILS_FILE);
  const idolsPath = path.join(RAW_DATA_DIR, IDOLS_FILE);

  console.log(`📂 Reading: ${detailsPath}`);
  console.log(`📂 Reading: ${idolsPath}`);

  const detailsData = JSON.parse(await fs.readFile(detailsPath, "utf-8"));
  const idolsData = JSON.parse(await fs.readFile(idolsPath, "utf-8"));

  const data = normalizeDetails(detailsData, idolsData);

  const normalizedPath = path.join(DATA_DIR, NORMALIZED_FILE);
  await fs.writeFile(normalizedPath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`✅ Normalized data saved to ${normalizedPath}`);
  console.log(`   - Idols: ${Object.keys(data.idols).length}`);
  console.log(`   - Accompaniments: ${Object.keys(data.accompaniments).length}`);

  // ========================
  // Phase 2: Precompute
  // ========================
  console.log("\n📊 Phase 2: Precomputing statistics...");

  // 出力ディレクトリを作成
  await fs.mkdir(IDOLS_DIR, { recursive: true });

  // 各種ランキングを計算
  console.log("📈 Computing ranking stats...");
  const ranking = computeIncomingStats(data);

  console.log("🔗 Computing PMI pairs...");
  const pmiPairs = computePMIRanking(data, 2);

  console.log("🌉 Computing cooccurrence companion pairs...");
  const cooccurrenceCompanionPairs = computeCooccurrenceCompanionPairs(data, 2);

  console.log("🔍 Detecting clusters...");
  const clusters = detectClusters(data, { minSize: 3, minDensity: 0.3 });

  console.log("🌐 Detecting cooccurrence companion clusters...");
  const cooccurrenceCompanionClusters = detectCooccurrenceCompanionClusters(
    data,
    cooccurrenceCompanionPairs,
    {
      minSize: 3,
      minEdges: 2,
    }
  );

  // メタデータ
  const metadata = {
    scrapedAt: data.scrapedAt,
    generatedAt: new Date().toISOString(),
    idolCount: Object.keys(data.idols).length,
  };

  // 一覧用データを出力
  console.log("💾 Writing ranking.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "ranking.json"),
    JSON.stringify({ data: ranking }, null, 2)
  );

  console.log("💾 Writing pmi-pairs.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "pmi-pairs.json"),
    JSON.stringify({ data: pmiPairs }, null, 2)
  );

  console.log("💾 Writing cooccurrence-companion.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "cooccurrence-companion.json"),
    JSON.stringify({ data: cooccurrenceCompanionPairs }, null, 2)
  );

  console.log("💾 Writing clusters.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "clusters.json"),
    JSON.stringify({ data: clusters }, null, 2)
  );

  console.log("💾 Writing cooccurrence-companion-clusters.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "cooccurrence-companion-clusters.json"),
    JSON.stringify({ data: cooccurrenceCompanionClusters }, null, 2)
  );

  console.log("💾 Writing metadata.json...");
  await fs.writeFile(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

  // ネットワークグラフ用データを出力
  console.log("💾 Writing network.json...");
  const networkData = {
    idols: Object.fromEntries(
      Object.entries(data.idols).map(([id, idol]) => [id, { name: idol.name, brand: idol.brand }])
    ),
    accompaniments: data.accompaniments,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "network.json"), JSON.stringify(networkData));

  // アイドル一覧用データを出力
  console.log("💾 Writing idol-list.json...");
  const idolList = Object.entries(data.idols).map(([id, idol]) => ({
    id,
    name: idol.name,
    brand: idol.brand,
    kana: idol.kana,
  }));
  await fs.writeFile(
    path.join(OUTPUT_DIR, "idol-list.json"),
    JSON.stringify({ data: idolList }, null, 2)
  );

  // SSG用のIDリストを出力
  const idolIds = Object.keys(data.idols);
  console.log("💾 Writing idol-ids.json...");
  await fs.writeFile(path.join(OUTPUT_DIR, "idol-ids.json"), JSON.stringify(idolIds, null, 2));

  // 個人ページ用データを出力
  console.log(`👤 Computing and writing ${idolIds.length} idol details...`);

  // 類似アイドル計算用のIDFマップを構築
  console.log("🔄 Building IDF map for similarity computation...");
  const idfMap = buildIdfMap(data);

  // 随伴類似ペアを計算
  console.log("👥 Computing similar by accompaniment pairs...");
  const similarByAccompanimentPairs = computeSimilarByAccompanimentPairs(data, idfMap, 2, 2000);

  console.log("💾 Writing similar-by-accompaniment.json...");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "similar-by-accompaniment.json"),
    JSON.stringify({ data: similarByAccompanimentPairs }, null, 2)
  );

  let count = 0;
  for (const idolId of idolIds) {
    const detail = computeIdolDetail(data, idolId, pmiPairs, cooccurrenceCompanionPairs);
    if (detail) {
      // 類似アイドルグループを計算して追加
      detail.similarIdolGroups = computeSimilarIdolGroups(data, idolId, idfMap, 20);
      await fs.writeFile(path.join(IDOLS_DIR, `${idolId}.json`), JSON.stringify(detail, null, 2));
      count++;
      if (count % 100 === 0) {
        console.log(`  ${count}/${idolIds.length} done...`);
      }
    }
  }

  // 完了サマリー
  console.log(`\n✅ Preprocessing complete!`);
  console.log(`   - ranking.json: ${ranking.length} entries`);
  console.log(`   - pmi-pairs.json: ${pmiPairs.length} pairs`);
  console.log(
    `   - cooccurrence-companion.json: ${cooccurrenceCompanionPairs.length} cooccurrence companion pairs`
  );
  console.log(
    `   - similar-by-accompaniment.json: ${similarByAccompanimentPairs.length} similar pairs`
  );
  console.log(`   - clusters.json: ${clusters.length} clusters`);
  console.log(
    `   - cooccurrence-companion-clusters.json: ${cooccurrenceCompanionClusters.length} cooccurrence companion clusters`
  );
  console.log(`   - idols/: ${count} files`);
}

run().catch((err) => {
  console.error("❌ Preprocessing failed:", err);
  process.exit(1);
});
