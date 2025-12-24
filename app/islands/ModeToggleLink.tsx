import type { ExplorerMode } from "./graphExplorerTypes";

interface Props {
  currentMode: ExplorerMode;
  onModeChange: (mode: ExplorerMode) => void;
}

/**
 * topdown/bottomup間を切り替えるトグル
 */
export default function ModeToggleLink({ currentMode, onModeChange }: Props) {
  const isTopdown = currentMode === "topdown";

  return (
    <button
      onClick={() => onModeChange(isTopdown ? "bottomup" : "topdown")}
      style={{
        color: "#aaa",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "12px",
        padding: 0,
      }}
    >
      {isTopdown ? "ボトムアップへ →" : "← トップダウンへ"}
    </button>
  );
}
