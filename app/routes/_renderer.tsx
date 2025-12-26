import { reactRenderer } from "@hono/react-renderer";
import { Script } from "honox/server";
import { SITE_TITLE } from "../lib/constants";

export default reactRenderer(
  ({ children, title }: { children: React.ReactNode; title?: string }) => {
    return (
      <html lang="ja">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title ?? SITE_TITLE}</title>
          <link rel="stylesheet" href="/static/style.css" />
        </head>
        <body>
          <div className="app">{children}</div>
          <Script src="/app/client.ts" async />
        </body>
      </html>
    );
  }
);
