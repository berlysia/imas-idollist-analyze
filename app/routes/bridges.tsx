import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CrossBrandBridge } from "../lib/compute";
import BridgesTable from "../islands/BridgesTable";

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
      <header>
        <h1>アイドルマスター 共起関係可視化</h1>
        <p className="metadata">
          データ取得日: {new Date(metadata.scrapedAt).toLocaleDateString("ja-JP")} /{" "}
          {metadata.idolCount}人のアイドル
        </p>
      </header>

      <nav className="tabs">
        <a
          href="/"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          被共起数ランキング
        </a>
        <a
          href="/pmi"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          相思相愛ペア
        </a>
        <a
          href="/bridges"
          className="active"
          style={{
            padding: "8px 16px",
            background: "#333",
            color: "#fff",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
          }}
        >
          ブランド横断ペア
        </a>
        <a
          href="/network"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ネットワーク
        </a>
      </nav>

      <main>
        <BridgesTable bridges={bridgeList} />
      </main>

      <footer>
        <p>
          データ出典:{" "}
          <a
            href="https://idollist.idolmaster-official.jp/"
            target="_blank"
            rel="noopener noreferrer"
          >
            アイドルマスター公式 IDOL LIST
          </a>
        </p>
      </footer>
    </>,
    { title: "ブランド横断ペア - アイドルマスター 共起関係可視化" }
  );
});
