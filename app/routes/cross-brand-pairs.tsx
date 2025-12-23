import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandBridge } from "../lib/compute";
import BridgesTable from "../islands/BridgesTable";
import { PageHeader, NavigationTabs, PageFooter, ExplanationBox } from "../components/shared";
import { SITE_TITLE } from "../lib/constants";

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
              とは、異なるブランドのアイドル2人が、複数のアイドルのページに同時に随伴として表示されているペアです。
            </p>
            <p>
              共起元数が多いほど、そのペアのアイドルと随伴して「お気に入り」されているアイドルが多いことを示します。
            </p>
            <p>
              PMI（Pointwise Mutual Information）値は、このペアが出現する可能性がどれだけ珍しいか、意味を伴っているかを示します。値が高いほど、全体の傾向に対して特徴的な関係です。
            </p>
          </ExplanationBox>
          <BridgesTable bridges={bridgeList} />
        </div>
      </main>
      <PageFooter />
    </>,
    { title: `ブランド横断ペア - ${SITE_TITLE}` }
  );
});
