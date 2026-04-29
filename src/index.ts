import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../_shared/turnstile';
import { renderScreenshotToolPage, turnstileSiteKeyFromEnv } from '../_shared/tool-page';

type Env = {
  Bindings: {
    BROWSER?: Fetcher;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  };
};

const app = new Hono<Env>();
app.use('/api/*', cors());

app.get('/', (c) => c.html(renderScreenshotToolPage({ title: 'URL Screenshot', description: 'Capture any public page as an image. When Browser Rendering is available, the screenshot is generated directly inside the Worker.', endpoint: '/api/screenshot', sample: '{ "url": "https://example.com", "imageUrl": "..." }', siteKey: turnstileSiteKeyFromEnv(c.env) })));
app.get('/health', (c) => c.json({ ok: true }));

app.get('/api/screenshot', async (c) => {
  const captcha = await verifyTurnstileToken(c.env, readTurnstileTokenFromUrl(c.req.url), c.req.header('CF-Connecting-IP'));
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);
  const normalized = normalizeUrl(c.req.query('url') ?? '');
  const format = (c.req.query('format') ?? 'json').toLowerCase();
  const fullPage = (c.req.query('fullPage') ?? 'false') === 'true';
  const width = clampNumber(c.req.query('width'), 1440, 320, 2560);
  const height = clampNumber(c.req.query('height'), 900, 320, 2560);
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  const browserSupported = Boolean(c.env.BROWSER);
  const imageUrl = `https://mini.s-shot.ru/${width}x${height}/JPEG/${width}/Z100/?${encodeURIComponent(normalized)}`;
  if (format === 'json') return c.json({ url: normalized, imageUrl, browserSupported, viewport: { width, height }, fullPage });

  if (browserSupported && (format === 'png' || format === 'jpeg' || format === 'jpg')) {
    const screenshot = await renderScreenshot(c.env.BROWSER!, normalized, width, height, fullPage, format === 'jpg' ? 'jpeg' : format as 'png' | 'jpeg');
    if (screenshot) {
      return new Response(screenshot, {
        headers: { 'content-type': `image/${format === 'jpg' ? 'jpeg' : format}` },
      });
    }
  }

  const upstream = await fetch(imageUrl);
  return new Response(upstream.body, {
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'image/jpeg' },
    status: upstream.status,
  });
});

async function renderScreenshot(browserBinding: Fetcher, url: string, width: number, height: number, fullPage: boolean, format: 'png' | 'jpeg') {
  let browser: any;
  try {
    browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const screenshot = await page.screenshot({ type: format, fullPage });
    return screenshot as ArrayBuffer;
  } catch {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUrl(value: string): string | null {
  try {
    const candidate = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
    const url = new URL(candidate.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default app;
