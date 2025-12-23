import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandBridge } from "../lib/compute";
import BridgesTable from "../islands/BridgesTable";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";

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
        <div className="chart-container">
          <h3>ブランド横断ペア</h3>
          <ExplanationBox>
            <p>
              <strong>ブランド横断ペア</strong>
              とは、異なるブランドのアイドル2人が、複数のアイドルから同時に共起として選ばれているペアです。
            </p>
            <p>
              投票者数が多いほど、ブランドを超えた人気の組み合わせであることを示します。
              PMI値は、このペアが偶然選ばれた場合と比較した「意外性」を示します。
            </p>
          </ExplanationBox>
          <BridgesTable bridges={bridgeList} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: "ブランド横断ペア - アイドルマスター アイドル名鑑 共起関係可視化" }
  );
});
