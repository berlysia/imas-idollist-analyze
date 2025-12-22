import type { NotFoundHandler } from "hono";

const handler: NotFoundHandler = (c) => {
  return c.render(
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h1>404 - ページが見つかりません</h1>
      <p>お探しのページは存在しないか、移動した可能性があります。</p>
      <p style={{ marginTop: "20px" }}>
        <a href="/" style={{ color: "#2681c8" }}>
          トップページに戻る
        </a>
      </p>
    </div>,
    { title: "404 - ページが見つかりません" }
  );
};

export default handler;
