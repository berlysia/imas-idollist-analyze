import type {} from "hono";

type Head = {
  title?: string;
};

declare module "hono" {
  interface Env {
    Variables: Record<string, unknown>;
    Bindings: Record<string, unknown>;
  }
  interface ContextRenderer {
    (content: string | Promise<string>, head?: Head): Response | Promise<Response>;
  }
}
