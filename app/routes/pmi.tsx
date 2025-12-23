import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { PairCooccurrence } from "../lib/compute";
import PMIFilter from "../islands/PMIFilter";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface PMIData {
  data: PairCooccurrence[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ pmiPairs: PMIData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [pmiRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "pmi-pairs.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    pmiPairs: JSON.parse(pmiRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { pmiPairs, metadata } = await loadData();
  const pairs = pmiPairs.data;

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/pmi" />
      <main>
        <PMIFilter pairs={pairs} />
      </main>
      <PageFooter />
    </>,
    { title: "相思相愛ペア - アイドルマスター 共起関係可視化" }
  );
});
