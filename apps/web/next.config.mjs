/**
 * Resolve the dashboard zone's origin.
 *
 * On a preview, uses Vercel's Related Projects wiring so the website preview
 * proxies to the dashboard preview of the same branch, which uses the preview
 * database and login. Proxying a preview to production would put preview
 * testers on real member data. apps/web/vercel.json lists the dashboard under
 * `relatedProjects`, which is what makes Vercel set VERCEL_RELATED_PROJECTS.
 *
 * Production, and anything else, uses DASHBOARD_URL, then the local dev port.
 */

/**
 * Reduce a configured URL to a bare origin.
 *
 * DASHBOARD_URL must be an origin only, because the rewrites below append
 * `/dashboard/:path*` themselves. Setting it to the URL you actually visit
 * (…vercel.app/dashboard) is the natural mistake and produces a destination of
 * /dashboard/dashboard/*, which the dashboard zone 404s — the page still comes
 * from the dashboard app, so it looks like a broken rewrite rather than a bad
 * env var. Normalizing here makes both forms work.
 */
function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    // Not a parseable absolute URL: strip a trailing /dashboard and any trailing
    // slash so a host:port style value still behaves.
    return value.replace(/\/+$/, "").replace(/\/dashboard$/, "");
  }
}

function dashboardOrigin() {
  const related = process.env.VERCEL_RELATED_PROJECTS;
  if (related) {
    try {
      // Shape, as Vercel actually sends it (seen in a build log):
      //   [{ "project": { "name": ... },
      //      "production": { "url": ..., "alias": ... },
      //      "preview": { "branch": "<dashboard>-git-<branch>-<team>.vercel.app" } }]
      // `preview.branch` is the dashboard's branch URL for this same git
      // branch. It only works once the dashboard has been deployed from this
      // branch, so a branch that never changes apps/dashboard gets a 404 at
      // /dashboard on its preview until someone redeploys the dashboard.
      //
      // Production is deliberately not read from here: it keeps using
      // DASHBOARD_URL, as it always has. An older version of this code read
      // `.host`, which Vercel never sends, so every build (previews too) fell
      // through to DASHBOARD_URL -- previews proxied to the production
      // dashboard.
      const projects = JSON.parse(related);
      const dashboard = projects.find((p) =>
        p?.project?.name?.includes("dashboard"),
      );
      const host =
        process.env.VERCEL_ENV === "preview"
          ? dashboard?.preview?.branch
          : undefined;
      if (host) return `https://${host}`;
    } catch {
      // Malformed value: fall through to the explicit env var below rather than
      // failing the build.
    }
  }

  const configured = process.env.DASHBOARD_URL;
  return configured ? toOrigin(configured) : "http://localhost:3001";
}

/**
 * Baseline security headers applied to every response from this origin.
 *
 * These do NOT apply to /dashboard/* - that zone is rewritten to a separate server, which supplies it's own headers via its own config.
 */
const securityHeaders = [
  // Anti-clickjacking: nothing should ever embed this site in an iframe.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Basic security: prevent MIME-sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Protect path data when requests leave origin (teachfirstbyte.com)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny camera, microphone, geolocation
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Files in public/ default to max-age=0, so returning visitors asked the
      // server again before reusing the 3D model. Model file names change
      // whenever the model changes (e.g. FirstByteBitex4.meshopt.glb), so a
      // year-long cache is safe.
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  /**
   * Serve the club dashboard under /dashboard on this domain.
   *
   * The dashboard is a separate Next app (apps/dashboard) with
   * basePath: "/dashboard", so it already emits its routes AND its assets under
   * that prefix. One rewrite therefore covers both /dashboard/* pages and
   * /dashboard/_next/* static files.
   */
  async rewrites() {
    const origin = dashboardOrigin();
    // Printed in the build log, so a preview that proxies to the wrong
    // dashboard is easy to spot. Vercel masks the value when it came from
    // DASHBOARD_URL (a sensitive variable), so the source is printed too.
    console.log(
      `Dashboard zone: ${origin} (VERCEL_RELATED_PROJECTS ${process.env.VERCEL_RELATED_PROJECTS ? "set" : "not set"}, VERCEL_ENV ${process.env.VERCEL_ENV ?? "not set"})`,
    );
    return [
      /**
       * Client-side navigations inside the dashboard zone fetch RSC payloads,
       * and the router asks for them at `<path>.rsc`. For the zone ROOT that is
       * "/dashboard.rsc", which matches NEITHER rule below: "/dashboard" is an
       * exact match, and "/dashboard/:path*" needs a "/" after "dashboard".
       *
       * With no match the request falls through to this app, which has no
       * /dashboard route, so it 404s. The dashboard's router treats a failed
       * RSC fetch as "this URL is not mine" and hands the navigation to the
       * browser instead -- a full page load. That is why searching or sorting
       * the Users table on the dashboard HOME jumped back to the top while the
       * same controls on /dashboard/attendance kept their scroll position:
       * nested routes match the ":path*" rule and never lost their RSC fetch.
       *
       * `scroll: false` on the router.replace() calls cannot help here; a full
       * page load is not a router navigation at all.
       *
       * The destination is the root route's payload path. Next serves the App
       * Router root as "index.rsc", so with the zone's basePath it is
       * "/dashboard/index.rsc" -- NOT "/dashboard.rsc".
       *
       * Must stay first: rewrites are matched in order, and "/dashboard/:path*"
       * would otherwise be reached only after this exact match fails.
       */
      {
        source: "/dashboard.rsc",
        destination: `${origin}/dashboard/index.rsc`,
      },
      {
        source: "/dashboard",
        destination: `${origin}/dashboard`,
      },
      {
        source: "/dashboard/:path*",
        destination: `${origin}/dashboard/:path*`,
      },
    ];
  },
};

export default nextConfig;
