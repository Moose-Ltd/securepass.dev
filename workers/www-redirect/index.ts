// www.securepass.dev -> securepass.dev, keeping the path and query (KTD2). The main site is an
// assets-only Worker with no script, and _redirects can't match on host, so this tiny Worker owns
// the www hostname alone. It only runs for www requests.

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.hostname = "securepass.dev";
    url.protocol = "https:";
    url.port = "";
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        "Cache-Control": "public, max-age=86400",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      },
    });
  },
};
