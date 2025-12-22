import { useState, useMemo } from "react";
import {
  useCooccurrenceData,
  computeIncomingStats,
  computePMIRanking,
  computeCrossBrandBridges,
  computeIdolDetail,
  useBrandName,
} from "./hooks/useCooccurrenceData";
import { CooccurrenceRanking } from "./components/CooccurrenceRanking";
import { PMIRanking } from "./components/PMIRanking";
import { CrossBrandBridges } from "./components/CrossBrandBridges";
import { NetworkGraph } from "./components/NetworkGraph";
import { IdolDetail } from "./components/IdolDetail";
import type { Brand } from "@/types";
import "./styles.css";

const ALL_BRANDS: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];

function BrandCheckbox({
  brand,
  checked,
  onChange,
}: {
  brand: Brand;
  checked: boolean;
  onChange: (brand: Brand, checked: boolean) => void;
}) {
  const name = useBrandName(brand);
  return (
    <label className={`brand-checkbox brand-${brand}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(brand, e.target.checked)}
      />
      {name}
    </label>
  );
}

export function App() {
  const { data, loading, error } = useCooccurrenceData();
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>(ALL_BRANDS);
  const [minConnections, setMinConnections] = useState(5);
  const [activeTab, setActiveTab] = useState<"ranking" | "pmi" | "bridges" | "network">("ranking");
  const [minPMICount, setMinPMICount] = useState(2);
  const [crossBrandOnly, setCrossBrandOnly] = useState(false);
  const [selectedIdolId, setSelectedIdolId] = useState<string | null>(null);

  const stats = useMemo(() => (data ? computeIncomingStats(data) : []), [data]);

  const pmiPairs = useMemo(
    () => (data ? computePMIRanking(data, minPMICount) : []),
    [data, minPMICount]
  );

  const crossBrandBridges = useMemo(() => (data ? computeCrossBrandBridges(data) : []), [data]);

  const allPmiPairs = useMemo(() => (data ? computePMIRanking(data, 2) : []), [data]);

  const selectedIdolDetail = useMemo(() => {
    if (!data || !selectedIdolId) return null;
    return computeIdolDetail(data, selectedIdolId, allPmiPairs, crossBrandBridges);
  }, [data, selectedIdolId, allPmiPairs, crossBrandBridges]);

  const filteredStats = useMemo(
    () => stats.filter((s) => s.brand.some((b) => selectedBrands.includes(b))),
    [stats, selectedBrands]
  );

  const filteredPMIPairs = useMemo(
    () =>
      pmiPairs.filter(
        (p) =>
          p.idolA.brand.some((b) => selectedBrands.includes(b)) &&
          p.idolB.brand.some((b) => selectedBrands.includes(b))
      ),
    [pmiPairs, selectedBrands]
  );

  const handleBrandChange = (brand: Brand, checked: boolean) => {
    setSelectedBrands((prev) => (checked ? [...prev, brand] : prev.filter((b) => b !== brand)));
  };

  const handleIdolClick = (idolId: string) => {
    setSelectedIdolId(idolId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    setSelectedIdolId(null);
  };

  if (loading) {
    return (
      <div className="app loading">
        <p>データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <p>エラー: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app error">
        <p>データが見つかりません</p>
      </div>
    );
  }

  if (selectedIdolId && selectedIdolDetail) {
    return (
      <div className="app">
        <header>
          <h1>アイドルマスター 共起関係可視化</h1>
          <p className="metadata">
            データ取得日時: {new Date(data.scrapedAt).toLocaleString("ja-JP")}
            {" / "}
            アイドル数: {Object.keys(data.idols).length}人
          </p>
        </header>

        <main>
          <IdolDetail
            detail={selectedIdolDetail}
            onBack={handleBackToList}
            onIdolClick={handleIdolClick}
          />
        </main>

        <footer>
          <p>
            データソース:{" "}
            <a
              href="https://idollist.idolmaster-official.jp/"
              target="_blank"
              rel="noopener noreferrer"
            >
              アイドルマスター公式 IDOL LIST
            </a>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>アイドルマスター 共起関係可視化</h1>
        <p className="metadata">
          データ取得日時: {new Date(data.scrapedAt).toLocaleString("ja-JP")}
          {" / "}
          アイドル数: {Object.keys(data.idols).length}人
        </p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "ranking" ? "active" : ""}
          onClick={() => setActiveTab("ranking")}
        >
          被共起数ランキング
        </button>
        <button className={activeTab === "pmi" ? "active" : ""} onClick={() => setActiveTab("pmi")}>
          相思相愛ペア
        </button>
        <button
          className={activeTab === "bridges" ? "active" : ""}
          onClick={() => setActiveTab("bridges")}
        >
          ブランド横断ペア
        </button>
        <button
          className={activeTab === "network" ? "active" : ""}
          onClick={() => setActiveTab("network")}
        >
          ネットワーク
        </button>
      </nav>

      <section className="filters">
        <div className="brand-filters">
          <span>ブランド:</span>
          {ALL_BRANDS.map((brand) => (
            <BrandCheckbox
              key={brand}
              brand={brand}
              checked={selectedBrands.includes(brand)}
              onChange={handleBrandChange}
            />
          ))}
        </div>
        {activeTab === "network" && (
          <div className="connection-filter">
            <label>
              最小被共起数:
              <input
                type="range"
                min={1}
                max={50}
                value={minConnections}
                onChange={(e) => setMinConnections(Number(e.target.value))}
              />
              {minConnections}
            </label>
          </div>
        )}
        {activeTab === "pmi" && (
          <div className="pmi-filters">
            <label>
              最低共起数:
              <input
                type="range"
                min={1}
                max={10}
                value={minPMICount}
                onChange={(e) => setMinPMICount(Number(e.target.value))}
              />
              {minPMICount}
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={crossBrandOnly}
                onChange={(e) => setCrossBrandOnly(e.target.checked)}
              />
              ブランド横断のみ
            </label>
          </div>
        )}
      </section>

      <main>
        {activeTab === "ranking" && (
          <CooccurrenceRanking
            stats={filteredStats}
            limit={30}
            title="被共起数ランキング（他のアイドルから選ばれた回数）"
            onIdolClick={handleIdolClick}
          />
        )}
        {activeTab === "pmi" && (
          <PMIRanking
            pairs={filteredPMIPairs}
            limit={100}
            showCrossBrandOnly={crossBrandOnly}
            onIdolClick={handleIdolClick}
          />
        )}
        {activeTab === "bridges" && (
          <CrossBrandBridges bridges={crossBrandBridges} onIdolClick={handleIdolClick} />
        )}
        {activeTab === "network" && (
          <NetworkGraph
            data={data}
            selectedBrands={selectedBrands}
            minConnections={minConnections}
          />
        )}
      </main>

      <footer>
        <p>
          データソース:{" "}
          <a
            href="https://idollist.idolmaster-official.jp/"
            target="_blank"
            rel="noopener noreferrer"
          >
            アイドルマスター公式 IDOL LIST
          </a>
        </p>
      </footer>
    </div>
  );
}
