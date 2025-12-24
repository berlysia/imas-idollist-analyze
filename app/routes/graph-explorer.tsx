import { createRoute } from "honox/factory";

export default createRoute(async (c) => {
  // クエリパラメータを維持してトップダウンにリダイレクト
  const url = new URL(c.req.url);
  const queryString = url.search;
  return c.redirect(`/graph-explorer/topdown${queryString}`, 302);
});
