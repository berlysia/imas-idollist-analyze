import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandBridge } from "../lib/compute";
import BridgesTable from "../islands/BridgesTable";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface BridgesData {
  data: CrossBrandBridge[];
}

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

async function loadData(): Promise<{ bridges: BridgesData; metadata: MetadataData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [bridgesRaw, metadataRaw] = await Promise.all([
    readFile(join(dataDir, "cross-brand.json"), "utf-8"),
    readFile(join(dataDir, "metadata.json"), "utf-8"),
  ]);
  return {
    bridges: JSON.parse(bridgesRaw),
    metadata: JSON.parse(metadataRaw),
  };
}

export default createRoute(async (c) => {
  const { bridges, metadata } = await loadData();
  const bridgeList = bridges.data;

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/cross-brand-pairs" />
      <main>
        <BridgesTable bridges={bridgeList} />
      </main>
      <PageFooter />
    </>,
    { title: "ブランド横断ペア - アイドルマスター アイドル名鑑 共起関係可視化" }
  );
});
