// Shuck - Technology detection
// Matches page signals and headers against known technologies

const TECH_DATABASE = [
  { name: 'React', patterns: [{ type: 'script', match: /react|react-dom/i }, { type: 'global', match: 'React' }, { type: 'global', match: 'ReactDOM' }] },
  { name: 'Vue.js', patterns: [{ type: 'script', match: /vue\.js|vue\.min/i }, { type: 'global', match: 'Vue' }] },
  { name: 'Angular', patterns: [{ type: 'script', match: /angular/i }, { type: 'global', match: 'angular' }] },
  { name: 'jQuery', patterns: [{ type: 'script', match: /jquery/i }, { type: 'global', match: 'jQuery' }, { type: 'global', match: '$' }] },
  { name: 'Bootstrap', patterns: [{ type: 'script', match: /bootstrap/i }, { type: 'link', match: /bootstrap/i }] },
  { name: 'WordPress', patterns: [{ type: 'meta', name: 'generator', match: /wordpress/i }, { type: 'script', match: /wp-content|wp-includes/i }, { type: 'link', match: /wp-content/i }] },
  { name: 'Drupal', patterns: [{ type: 'meta', name: 'generator', match: /drupal/i }, { type: 'header', match: /x-drupal/i }] },
  { name: 'Google Analytics', patterns: [{ type: 'script', match: /google-analytics|googletagmanager|gtag|ga\.js/i }, { type: 'global', match: 'ga' }, { type: 'global', match: 'gtag' }] },
  { name: 'Google Tag Manager', patterns: [{ type: 'script', match: /googletagmanager\.com\/gtm\.js/i }, { type: 'global', match: 'dataLayer' }] },
  { name: 'Facebook Pixel', patterns: [{ type: 'script', match: /connect\.facebook\.net|fbq/i }, { type: 'global', match: 'fbq' }] },
  { name: 'Stripe', patterns: [{ type: 'script', match: /stripe\.com\/js/i }, { type: 'global', match: 'Stripe' }] },
  { name: 'Alpine.js', patterns: [{ type: 'script', match: /alpinejs/i }, { type: 'global', match: 'Alpine' }] },
  { name: 'HTMX', patterns: [{ type: 'script', match: /htmx/i }] },
  { name: 'Moment.js', patterns: [{ type: 'script', match: /moment\.js|moment\.min/i }, { type: 'global', match: 'moment' }] },
  { name: 'Lodash', patterns: [{ type: 'script', match: /lodash/i }, { type: 'global', match: '_' }] },
  { name: 'Chart.js', patterns: [{ type: 'script', match: /chart\.js|chartjs/i }, { type: 'global', match: 'Chart' }] },
  { name: 'reCAPTCHA', patterns: [{ type: 'script', match: /recaptcha|google\.com\/recaptcha/i }, { type: 'global', match: 'grecaptcha' }] },
  { name: 'Highlight.js', patterns: [{ type: 'script', match: /highlight\.js|hljs/i }, { type: 'global', match: 'hljs' }] },
  { name: 'Next.js', patterns: [{ type: 'script', match: /_next\/static/i }, { type: 'meta', name: 'next-head-count' }] },
  { name: 'Nuxt.js', patterns: [{ type: 'script', match: /_nuxt\//i }, { type: 'meta', name: 'generator', match: /nuxt/i }] },
  { name: 'Shopify', patterns: [{ type: 'script', match: /shopify\.com|cdn\.shopify/i }, { type: 'link', match: /shopify/i }] },
  { name: 'Wix', patterns: [{ type: 'script', match: /wix\.com|parastorage/i }] },
  { name: 'Squarespace', patterns: [{ type: 'script', match: /squarespace/i }] },
  { name: 'Google Fonts', patterns: [{ type: 'link', match: /fonts\.googleapis\.com|fonts\.google\.com/i }] },
  { name: 'Cloudflare', patterns: [{ type: 'header', match: /cf-ray|cloudflare/i }] },
  { name: 'PHP', patterns: [{ type: 'header', match: /x-powered-by.*php/i }] },
  { name: 'ASP.NET', patterns: [{ type: 'header', match: /x-aspnet|x-powered-by.*aspnet/i }] },
  { name: 'Node.js', patterns: [{ type: 'header', match: /x-powered-by.*express|node/i }] },
  { name: 'Nginx', patterns: [{ type: 'header', match: /server.*nginx/i }] },
  { name: 'Apache', patterns: [{ type: 'header', match: /server.*apache/i }] },
];

function detectTechnologies(signals, headers) {
  const found = new Map();
  const scripts = (signals && signals.scripts) || [];
  const links = (signals && signals.links) || [];
  const meta = (signals && signals.meta) || [];
  const globals = (signals && signals.globals) || [];
  const headerStr = headers ? Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase() : '';

  for (const tech of TECH_DATABASE) {
    for (const p of tech.patterns) {
      if (p.type === 'script' && scripts.some(s => (typeof p.match === 'string' ? s.includes(p.match) : p.match.test(s)))) {
        found.set(tech.name, true);
        break;
      }
      if (p.type === 'link' && links.some(l => {
        const href = (typeof l === 'string' ? l : l.href || '');
        return typeof p.match === 'string' ? href.includes(p.match) : p.match.test(href);
      })) {
        found.set(tech.name, true);
        break;
      }
      if (p.type === 'meta') {
        const nameMatch = p.name && meta.some(m => (m.name || '').toLowerCase() === p.name.toLowerCase());
        const contentMatch = !p.match || meta.some(m => (typeof p.match === 'string' ? (m.content || '').includes(p.match) : p.match.test(m.content || '')));
        if ((p.name ? nameMatch : true) && contentMatch) {
          found.set(tech.name, true);
          break;
        }
      }
      if (p.type === 'global' && globals.includes(p.match)) {
        found.set(tech.name, true);
        break;
      }
      if (p.type === 'header' && (typeof p.match === 'string' ? headerStr.includes(p.match.toLowerCase()) : p.match.test(headerStr))) {
        found.set(tech.name, true);
        break;
      }
    }
  }
  return [...found.keys()];
}

function getRelevantHeaders(headersObj) {
  const names = ['server', 'x-powered-by', 'x-generator', 'x-drupal-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-frame-options', 'x-content-type-options', 'cf-ray', 'x-request-id', 'via'];
  const out = {};
  const lower = {};
  for (const [k, v] of Object.entries(headersObj || {})) {
    lower[k.toLowerCase()] = v;
  }
  for (const n of names) {
    if (lower[n]) out[n] = lower[n];
  }
  return out;
}

// Used by background.js via inline copy; this file is for reference only.
