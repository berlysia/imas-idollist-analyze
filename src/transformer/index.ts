import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeDetails } from "./normalizeDetails.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

async function run(): Promise<void> {
  const files = await fs.readdir(DATA_DIR);
  const latestDetailsFile = files
    .filter((f) => f.startsWith("details-") && f.endsWith(".json"))
    .sort()
    .pop();

  if (!latestDetailsFile) {
    throw new Error("No details file found. Run details scrape first.");
  }

  const detailsData = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, latestDetailsFile), "utf-8")
  );

  const normalized = normalizeDetails(detailsData);

  const dateStr = latestDetailsFile.replace("details-", "").replace(".json", "");
  const filename = `normalized-${dateStr}.json`;
  const filepath = path.join(DATA_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(normalized, null, 2), "utf-8");

  process.stdout.write(`Normalized data saved to ${filename}\n`);
  process.stdout.write(`  - Idols: ${Object.keys(normalized.idols).length}\n`);
  process.stdout.write(`  - Cooccurrences: ${Object.keys(normalized.cooccurrences).length}\n`);
}

run();
