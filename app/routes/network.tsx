import { createRoute } from "honox/factory";
import { readFile } from "fs/promises";
import { join } from "path";
import NetworkGraph from "../islands/NetworkGraph";
import type { Brand } from "@/types";

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
          className="active"
          style={{
            padding: "8px 16px",
            background: "#333",
            color: "#fff",
            borderRadius: "4px 4px 0 0",
            textDecoration: "none",
          }}
        >
          ネットワーク
        </a>
      </nav>

      <main>
        <div className="chart-container">
          <h3>ネットワークグラフ</h3>
          <NetworkGraph data={network} initialMinConnections={5} />
        </div>
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
    { title: "ネットワーク - アイドルマスター 共起関係可視化" }
  );
});
