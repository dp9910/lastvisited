// Normalizes tab URLs so duplicate pages compare equal regardless of
// tracking params, param ordering, or www/trailing-slash differences.

const TRACKING_PARAM_PREFIXES = ['utm_'];

const TRACKING_PARAM_NAMES = new Set([
  'ref', 'ref_src', 'ref_url',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'yclid', 'twclid',
  'mc_cid', 'mc_eid',
  'igshid', 'igsh',
  '_hsenc', '_hsmid',
  'spm', 'scm', 'icid',
  'psc', 'th', 'pf_rd_p', 'pf_rd_r', 'pd_rd_i', 'pd_rd_r', 'pd_rd_w', 'pd_rd_wg',
  'spReferrer', 'sprefix', 'qid', 'crid', 'sr',
]);

// Site-specific stable-ID extractors. Each returns a normalized identity
// string when the URL matches, or null to fall through to generic normalization.
const SITE_EXTRACTORS = [
  {
    // Amazon: /dp/{ASIN}, /gp/product/{ASIN}, /gp/aw/d/{ASIN} (mobile app
    // links), or the legacy /exec/obidos/asin/{ASIN} — any query string.
    hostTest: (host) => /(^|\.)amazon\.[a-z.]+$/i.test(host),
    extract: (host, pathname) => {
      // Subdomains like smile./m. are the same marketplace as the bare
      // domain, just a different front door — collapse them so tabs on
      // smile.amazon.com and www.amazon.com for the same ASIN still match.
      const marketplace = host.match(/amazon\.[a-z.]+$/i)?.[0] ?? host;
      const match = pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})\b/i);
      return match ? `amazon:${marketplace}:${match[1].toUpperCase()}` : null;
    },
  },
];

function stripTrackingParams(searchParams) {
  for (const key of Array.from(searchParams.keys())) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAM_NAMES.has(lower) || TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) {
      searchParams.delete(key);
    }
  }
  return searchParams;
}

const SKIPPED_SCHEMES = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'devtools://'];

function isTrackableUrl(url) {
  return !!url && !SKIPPED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

function normalizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return rawUrl;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  for (const extractor of SITE_EXTRACTORS) {
    if (extractor.hostTest(host)) {
      const identity = extractor.extract(host, url.pathname);
      if (identity) return identity;
    }
  }

  const params = stripTrackingParams(url.searchParams);
  const sortedSearch = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b))).toString();

  const path = url.pathname.replace(/\/$/, '') || '/';

  return `${host}${path}${sortedSearch ? '?' + sortedSearch : ''}`;
}

// Exposed for the service worker (importScripts), the popup, and tests.
if (typeof self !== 'undefined') {
  self.normalizeUrl = normalizeUrl;
  self.isTrackableUrl = isTrackableUrl;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeUrl, isTrackableUrl };
}
