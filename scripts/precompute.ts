/**
 * 事前計算スクリプト
 * ビルド時に実行し、全計算結果をJSONファイルとして出力
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  computeIncomingStats,
  computePMIRanking,
  computeCrossBrandBridges,
  computeIdolDetail,
  detectClusters,
  detectCrossBrandClusters,
  computeSimilarIdols,
  buildIdfMap,
  type NormalizedData,
} from "../app/lib/compute";

const DATA_DIR = join(import.meta.dirname, "../data");
const OUTPUT_DIR = join(DATA_DIR, "precomputed");
const IDOLS_DIR = join(OUTPUT_DIR, "idols");

const NORMALIZED_FILE = "normalized.json";

function getNormalizedFilePath(): string {
  return join(DATA_DIR, NORMALIZED_FILE);
}

async function main() {
  console.log("🚀 Starting precomputation...");

  // 1. normalizedファイルを読み込み
  const inputPath = getNormalizedFilePath();
  console.log(`📂 Reading: ${inputPath}`);
  const rawData = await readFile(inputPath, "utf-8");
  const data: NormalizedData = JSON.parse(rawData);

  console.log(`📊 Found ${Object.keys(data.idols).length} idols`);

  // 2. 出力ディレクトリを作成
  await mkdir(IDOLS_DIR, { recursive: true });

  // 3. 各種ランキングを計算
  console.log("📈 Computing ranking stats...");
  const ranking = computeIncomingStats(data);

  console.log("🔗 Computing PMI pairs...");
  const pmiPairs = computePMIRanking(data, 2);

  console.log("🌉 Computing cross-brand bridges...");
  const crossBrandBridges = computeCrossBrandBridges(data, 2);

  console.log("🔍 Detecting clusters...");
  const clusters = detectClusters(data, { minSize: 3, minDensity: 0.3 });

  console.log("🌐 Detecting cross-brand clusters...");
  const crossBrandClusters = detectCrossBrandClusters(data, crossBrandBridges, {
    minSize: 3,
    minEdges: 2,
  });

  // 4. メタデータ
  const metadata = {
    scrapedAt: data.scrapedAt,
    generatedAt: new Date().toISOString(),
    idolCount: Object.keys(data.idols).length,
  };

  // 5. 一覧用データを出力
  console.log("💾 Writing ranking.json...");
  await writeFile(join(OUTPUT_DIR, "ranking.json"), JSON.stringify({ data: ranking }, null, 2));

  console.log("💾 Writing pmi-pairs.json...");
  await writeFile(join(OUTPUT_DIR, "pmi-pairs.json"), JSON.stringify({ data: pmiPairs }, null, 2));

  console.log("💾 Writing cross-brand.json...");
  await writeFile(
    join(OUTPUT_DIR, "cross-brand.json"),
    JSON.stringify({ data: crossBrandBridges }, null, 2)
  );

  console.log("💾 Writing clusters.json...");
  await writeFile(join(OUTPUT_DIR, "clusters.json"), JSON.stringify({ data: clusters }, null, 2));

  console.log("💾 Writing cross-brand-clusters.json...");
  await writeFile(
    join(OUTPUT_DIR, "cross-brand-clusters.json"),
    JSON.stringify({ data: crossBrandClusters }, null, 2)
  );

  console.log("💾 Writing metadata.json...");
  await writeFile(join(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

  // 6. ネットワークグラフ用データを出力
  console.log("💾 Writing network.json...");
  const networkData = {
    idols: Object.fromEntries(
      Object.entries(data.idols).map(([id, idol]) => [id, { name: idol.name, brand: idol.brand }])
    ),
    accompaniments: data.accompaniments,
  };
  await writeFile(join(OUTPUT_DIR, "network.json"), JSON.stringify(networkData));

  // 6.5. アイドル一覧用データを出力
  console.log("💾 Writing idol-list.json...");
  const idolList = Object.entries(data.idols).map(([id, idol]) => ({
    id,
    name: idol.name,
    brand: idol.brand,
    kana: idol.kana,
  }));
  await writeFile(join(OUTPUT_DIR, "idol-list.json"), JSON.stringify({ data: idolList }, null, 2));

  // 7. SSG用のIDリストを出力
  const idolIds = Object.keys(data.idols);
  console.log("💾 Writing idol-ids.json...");
  await writeFile(join(OUTPUT_DIR, "idol-ids.json"), JSON.stringify(idolIds, null, 2));

  // 8. 個人ページ用データを出力
  console.log(`👤 Computing and writing ${idolIds.length} idol details...`);

  // 類似アイドル計算用のIDFマップを構築
  console.log("🔄 Building IDF map for similarity computation...");
  const idfMap = buildIdfMap(data);

  let count = 0;
  for (const idolId of idolIds) {
    const detail = computeIdolDetail(data, idolId, pmiPairs, crossBrandBridges);
    if (detail) {
      // 類似アイドルを計算して追加
      detail.similarIdols = computeSimilarIdols(data, idolId, idfMap, 10);
      await writeFile(join(IDOLS_DIR, `${idolId}.json`), JSON.stringify(detail, null, 2));
      count++;
      if (count % 100 === 0) {
        console.log(`  ${count}/${idolIds.length} done...`);
      }
    }
  }

  console.log(`✅ Precomputation complete!`);
  console.log(`   - ranking.json: ${ranking.length} entries`);
  console.log(`   - pmi-pairs.json: ${pmiPairs.length} pairs`);
  console.log(`   - cross-brand.json: ${crossBrandBridges.length} bridges`);
  console.log(`   - clusters.json: ${clusters.length} clusters`);
  console.log(`   - cross-brand-clusters.json: ${crossBrandClusters.length} cross-brand clusters`);
  console.log(`   - idols/: ${count} files`);
}

main().catch((err) => {
  console.error("❌ Precomputation failed:", err);
  process.exit(1);
});
