/**
 * ベースパスを適用したURLを構築する
 * Viteのimport.meta.env.BASE_URLを使用してサブパスデプロイに対応
 */
export function withBasePath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  // baseは末尾に/がある（例: "/subpath/"）、pathは先頭に/がある（例: "/idol/123"）
  // 重複する/を除去して結合
  if (base === "/") {
    return path;
  }
  // baseから末尾の/を除去し、pathと結合
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}${path}`;
}
