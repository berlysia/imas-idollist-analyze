import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeDetails } from "./normalizeDetails.ts";

const RAW_DATA_DIR = path.resolve(import.meta.dirname, "../../data/raw");
const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

const IDOLS_FILE = "idols.json";
const DETAILS_FILE = "details.json";
const NORMALIZED_FILE = "normalized.json";

async function run(): Promise<void> {
  const detailsPath = path.join(RAW_DATA_DIR, DETAILS_FILE);
  const idolsPath = path.join(RAW_DATA_DIR, IDOLS_FILE);

  const detailsData = JSON.parse(await fs.readFile(detailsPath, "utf-8"));
  const idolsData = JSON.parse(await fs.readFile(idolsPath, "utf-8"));

  const normalized = normalizeDetails(detailsData, idolsData);

  const filepath = path.join(DATA_DIR, NORMALIZED_FILE);

  await fs.writeFile(filepath, JSON.stringify(normalized, null, 2), "utf-8");

  process.stdout.write(`Normalized data saved to ${filepath}\n`);
  process.stdout.write(`  - Idols: ${Object.keys(normalized.idols).length}\n`);
  process.stdout.write(`  - Recommendations: ${Object.keys(normalized.accompaniments).length}\n`);
}

run();
