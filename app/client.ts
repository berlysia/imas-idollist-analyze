import { createClient } from "honox/client";

createClient({
  hydrate: async (elem, root) => {
    const { hydrateRoot } = await import("react-dom/client");
    hydrateRoot(root, elem as unknown as React.ReactNode);
  },
  createElement: async (type: React.ComponentType<unknown>, props: Record<string, unknown>) => {
    const { createElement } = await import("react");
    return createElement(type, props) as unknown as Node;
  },
});
