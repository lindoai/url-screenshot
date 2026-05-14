import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderScreenshotToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = {
  Bindings: {
    BROWSER?: Fetcher;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  };
};

const app = new Hono<Env>();
app.use('/api/*', cors());

app.get('/', (c) => c.html(renderScreenshotToolPage({ title: 'URL Screenshot', description: 'Capture any public page as an image using Cloudflare Browser Rendering.', endpoint: '/api/screenshot', sample: '{ "url": "https://example.com", "imageUrl": "..." }', siteKey: turnstileSiteKeyFromEnv(c.env) })));
app.get('/health', (c) => c.json({ ok: true }));

app.get('/api/screenshot', async (c) => {
  const captcha = await verifyTurnstileToken(c.env, readTurnstileTokenFromUrl(c.req.url), c.req.header('CF-Connecting-IP'));
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);

  const normalized = normalizeUrl(c.req.query('url') ?? '');
  const format = (c.req.query('format') ?? 'png').toLowerCase();
  const fullPage = (c.req.query('fullPage') ?? 'false') === 'true';
  const width = clampNumber(c.req.query('width'), 1440, 320, 2560);
  const height = clampNumber(c.req.query('height'), 900, 320, 2560);

  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  if (!c.env.BROWSER) {
    return c.json({ error: 'Browser Rendering is not available on this worker.' }, 503);
  }

  const imageFormat = (format === 'jpg' || format === 'jpeg') ? 'jpeg' : 'png';

  // Always use Puppeteer for actual screenshots
  if (format === 'json') {
    // For JSON format, take the screenshot and return as base64
    const screenshot = await renderScreenshot(c.env.BROWSER, normalized, width, height, fullPage, 'png');
    if (!screenshot) {
      return c.json({ error: 'Failed to capture screenshot. The page may be unreachable or took too long to load.' }, 502);
    }
    const base64 = arrayBufferToBase64(screenshot);
    return c.json({
      url: normalized,
      viewport: { width, height },
      fullPage,
      format: 'png',
      imageBase64: base64,
      imageDataUrl: `data:image/png;base64,${base64}`,
    });
  }

  // For png/jpeg format, return the image directly
  const screenshot = await renderScreenshot(c.env.BROWSER, normalized, width, height, fullPage, imageFormat);
  if (!screenshot) {
    return c.json({ error: 'Failed to capture screenshot. The page may be unreachable or took too long to load.' }, 502);
  }

  return new Response(screenshot, {
    headers: { 'content-type': `image/${imageFormat}` },
  });
});

async function renderScreenshot(browserBinding: Fetcher, url: string, width: number, height: number, fullPage: boolean, format: 'png' | 'jpeg'): Promise<ArrayBuffer | null> {
  let browser: any;
  try {
    browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Always disable animations: inject CSS + force inline styles via JS
    // Run AFTER page load to ensure animation libraries have already set their styles
    await page.evaluate(() => {
      // Inject a style element directly into the DOM (more reliable than addStyleTag in CF)
      const style = document.createElement('style');
      style.textContent = `
        [data-motion], [data-animate], .motion-word,
        [data-aos], [data-scroll], [data-sal],
        [lindo-animate], [data-lindo-animate],
        .wow, .reveal, .animate-on-scroll,
        .gsap-hidden, [data-gsap], [data-framer],
        .is-hidden, .not-visible {
          opacity: 1 !important;
          transform: none !important;
          filter: none !important;
          visibility: visible !important;
          transition: none !important;
          animation: none !important;
        }
      `;
      document.head.appendChild(style);

      // Force visibility via inline styles
      const selectors = [
        '[data-motion]', '[data-animate]', '.motion-word',
        '[data-aos]', '[data-scroll]', '[data-sal]',
        '[lindo-animate]', '[data-lindo-animate]',
        '.wow', '.reveal', '.animate-on-scroll',
        '.gsap-hidden', '[data-gsap]', '[data-framer]',
        '.is-hidden', '.not-visible'
      ];
      document.querySelectorAll(selectors.join(',')).forEach((el) => {
        (el as HTMLElement).style.setProperty('opacity', '1', 'important');
        (el as HTMLElement).style.setProperty('transform', 'none', 'important');
        (el as HTMLElement).style.setProperty('filter', 'none', 'important');
        (el as HTMLElement).style.setProperty('visibility', 'visible', 'important');
      });
      // Catch anything with opacity 0
      document.querySelectorAll('*').forEach((el) => {
        const h = el as HTMLElement;
        if (h.style.opacity === '0' || window.getComputedStyle(h).opacity === '0') {
          h.style.setProperty('opacity', '1', 'important');
          h.style.setProperty('transform', 'none', 'important');
          h.style.setProperty('filter', 'none', 'important');
        }
      });
    });

    if (fullPage) {
      // Scroll through the page to trigger lazy-loaded images
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 400;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for lazy images to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Force visibility AGAIN after scroll (new elements may have appeared)
      await page.evaluate(() => {
        document.querySelectorAll('*').forEach((el) => {
          const h = el as HTMLElement;
          if (h.style.opacity === '0' || window.getComputedStyle(h).opacity === '0') {
            h.style.setProperty('opacity', '1', 'important');
            h.style.setProperty('transform', 'none', 'important');
            h.style.setProperty('filter', 'none', 'important');
          }
        });
      });

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const screenshot = await page.screenshot({ type: format, fullPage });
    return screenshot as ArrayBuffer;
  } catch {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
