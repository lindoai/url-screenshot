# URL Screenshot

Capture a public webpage as an image using a small Cloudflare Worker.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/url-screenshot)

## Features

- JSON metadata mode
- JPEG or PNG output
- viewport width and height options
- full-page capture option
- Browser Rendering support when `BROWSER` binding is available
- fallback screenshot mode for local/dev environments

## Local development

```bash
npm install
npm run dev
npm run typecheck
```

## Deploy

```bash
npm run deploy
```

## Production env

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Optional binding:

- `BROWSER`

## API

### GET `/api/screenshot?url=https://example.com`

Returns JSON metadata.

### GET `/api/screenshot?url=https://example.com&format=jpeg`

Returns an image response.

### GET `/api/screenshot?url=https://example.com&format=png&width=1440&height=900&fullPage=true`

Returns a full-page PNG when supported.
