import { fetchIdolList } from "./fetchIdolList.ts";
import { fetchAllIdolDetails } from "./fetchIdolDetails.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

async function saveJson(filename: string, data: unknown): Promise<void> {
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
}

async function runListScrape(): Promise<void> {
  const result = await fetchIdolList();
  const filename = `idols-${new Date().toISOString().slice(0, 10)}.json`;
  await saveJson(filename, result);
}

async function runDetailsScrape(): Promise<void> {
  const files = await fs.readdir(DATA_DIR);
  const latestIdolsFile = files
    .filter((f) => f.startsWith("idols-") && f.endsWith(".json"))
    .sort()
    .pop();

  if (!latestIdolsFile) {
    throw new Error("No idols file found. Run list scrape first.");
  }

  const idolsData = JSON.parse(await fs.readFile(path.join(DATA_DIR, latestIdolsFile), "utf-8"));

  const details = await fetchAllIdolDetails(idolsData.data);
  const filename = `details-${new Date().toISOString().slice(0, 10)}.json`;
  await saveJson(filename, {
    scrapedAt: new Date().toISOString(),
    count: details.length,
    data: details,
  });
}

const command = process.argv[2];

if (command === "list") {
  runListScrape();
} else if (command === "details") {
  runDetailsScrape();
} else {
  process.stderr.write("Usage: bun src/scraper/index.ts <list|details>\n");
  process.exit(1);
}
