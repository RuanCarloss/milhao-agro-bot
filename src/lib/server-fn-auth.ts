// Patches global fetch so Supabase bearer token is attached to TanStack
// server-function calls (`/_serverFn/...`). The auth-middleware on the server
// reads this header and rejects requests without it (401).
import { supabase } from "@/integrations/supabase/client";

let installed = false;

export function installServerFnAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/_serverFn/")) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    }

    return originalFetch(input, init);
  }) as typeof fetch;
}
