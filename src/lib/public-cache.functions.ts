import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

/**
 * Sets edge cache headers on the SSR response for public pages.
 * 60s shared cache + 5min stale-while-revalidate to absorb traffic spikes
 * without putting pressure on the database.
 */
export const setPublicCacheHeaders = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeaders(
    new Headers({
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    }),
  );
  return { ok: true };
});
