import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import NetworkGraph from "../islands/NetworkGraph";
import type { Brand } from "@/types";
import { PageHeader, NavigationTabs, PageFooter } from "../components/shared";

interface MetadataData {
  scrapedAt: string;
  generatedAt: string;
  idolCount: number;
}

interface NetworkData {
  idols: Record<string, { name: string; brand: Brand[] }>;
  cooccurrences: Record<string, string[]>;
}

async function loadData(): Promise<{ metadata: MetadataData; network: NetworkData }> {
  const dataDir = join(process.cwd(), "data/precomputed");
  const [metadataRaw, networkRaw] = await Promise.all([
    readFile(join(dataDir, "metadata.json"), "utf-8"),
    readFile(join(dataDir, "network.json"), "utf-8"),
  ]);
  return {
    metadata: JSON.parse(metadataRaw),
    network: JSON.parse(networkRaw),
  };
}

export default createRoute(async (c) => {
  const { metadata, network } = await loadData();

  return c.render(
    <>
      <PageHeader metadata={metadata} />
      <NavigationTabs activeTab="/network" />
      <main>
        <div className="chart-container">
          <h3>ネットワークグラフ</h3>
          <NetworkGraph data={network} initialMinConnections={5} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: "ネットワーク - アイドルマスター 共起関係可視化" }
  );
});
