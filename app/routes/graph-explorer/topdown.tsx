import { createRoute } from "honox/factory";
import GraphExplorer from "../../islands/GraphExplorer";
import { SITE_TITLE } from "../../lib/constants";
import { loadGraphExplorerData } from "../../lib/graphExplorerData";

export default createRoute(async (c) => {
  const { idolList, normalized, idfMap, pmiMap, cooccurrenceCompanionPairs } =
    await loadGraphExplorerData();

  return c.render(
    <div
      data-fullscreen
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* 軽量ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#333",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="/"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            ← 戻る
          </a>
          <span style={{ fontSize: "14px" }}>トップダウン グラフ探索</span>
          <a
            href="/graph-explorer/bottomup"
            style={{
              color: "#aaa",
              textDecoration: "none",
              fontSize: "12px",
            }}
          >
            ボトムアップへ →
          </a>
        </div>
        <span style={{ fontSize: "11px", color: "#aaa" }}>
          ドラッグでノード移動 / ダブルクリックで固定 / ホイールでズーム
        </span>
      </header>

      {/* フルスクリーングラフ */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        <GraphExplorer
          idolList={idolList}
          accompaniments={normalized.accompaniments}
          idols={normalized.idols}
          idfMap={idfMap}
          pmiMap={pmiMap}
          cooccurrenceCompanionPairs={cooccurrenceCompanionPairs}
          mode="topdown"
        />
      </main>
    </div>,
    { title: `トップダウン グラフ探索 - ${SITE_TITLE}` }
  );
});
