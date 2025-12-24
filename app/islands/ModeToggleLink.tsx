import { useEffect, useState } from "react";

interface Props {
  /** 遷移先モード */
  targetMode: "topdown" | "bottomup";
}

/**
 * topdown/bottomup間を遷移するリンク
 * 現在のクエリパラメータを維持したまま遷移する
 */
export default function ModeToggleLink({ targetMode }: Props) {
  const [href, setHref] = useState(`/graph-explorer/${targetMode}`);

  useEffect(() => {
    // クライアントサイドでクエリパラメータを取得してリンクに付加
    const search = window.location.search;
    setHref(`/graph-explorer/${targetMode}${search}`);
  }, [targetMode]);

  const isTopdown = targetMode === "topdown";
  const label = isTopdown ? "← トップダウンへ" : "ボトムアップへ →";

  return (
    <a
      href={href}
      style={{
        color: "#aaa",
        textDecoration: "none",
        fontSize: "12px",
      }}
    >
      {label}
    </a>
  );
}
