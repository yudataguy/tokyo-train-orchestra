/** Cloudflare Web Analytics: cookieless pageviews. This is the japantv.app site's
 *  token: Cloudflare accepts it on any *.japantv.app host, so the whole family
 *  reports to one dashboard, split by hostname.
 *
 *  The guard mirrors japantv.app's: visiting `?notrack` sets
 *  localStorage['tv-notrack'] for good (`?track` clears it), and while it is set
 *  the beacon is never injected. localStorage is per-origin, so opting out on
 *  japantv.app does not opt you out here: visit `?notrack` on this host too. */
export const CF_BEACON_TOKEN = 'd1a8774be9d0432fb5baa82374f3ce48';

export const cfBeaconScript = `
try {
  var p = new URLSearchParams(location.search);
  if (p.has("notrack")) localStorage.setItem("tv-notrack", "1");
  else if (p.has("track")) localStorage.removeItem("tv-notrack");
  if (localStorage.getItem("tv-notrack") !== "1") {
    var b = document.createElement("script");
    b.defer = true;
    b.src = "https://static.cloudflareinsights.com/beacon.min.js";
    b.setAttribute("data-cf-beacon", JSON.stringify({ token: "${CF_BEACON_TOKEN}" }));
    document.head.appendChild(b);
  }
} catch (e) { /* storage blocked: skip analytics rather than risk a throw */ }
`;
