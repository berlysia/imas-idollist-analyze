import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import type { PairCooccurrence } from "../lib/compute";
import PMIFilter from "../islands/PMIFilter";

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
          className="active"
          style={{
            padding: "8px 16px",
            background: "#333",
            color: "#fff",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
          }}
        >
          相思相愛ペア
        </a>
        <a
          href="/bridges"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ブランド横断ペア
        </a>
        <a
          href="/clusters"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          クラスタ
        </a>
        <a
          href="/cross-brand-clusters"
          style={{
            padding: "8px 16px",
            background: "#e0e0e0",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ブランド横断クラスタ
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
        <PMIFilter pairs={pairs} />
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
    { title: "相思相愛ペア - アイドルマスター 共起関係可視化" }
  );
});
