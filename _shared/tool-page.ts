import { getTurnstileSiteKey, turnstileMarkup, turnstileScriptTag, turnstileUiScript } from './turnstile';

type TextToolOptions = {
  title: string;
  description: string;
  endpoint: string;
  sample: string;
  siteKey: string;
  buttonLabel: string;
  formatOptions?: Array<{ value: string; label: string }>;
};

type ScreenshotToolOptions = {
  title: string;
  description: string;
  endpoint: string;
  sample: string;
  siteKey: string;
};

export function renderTextToolPage(options: TextToolOptions) {
  const hasFormats = (options.formatOptions?.length ?? 0) > 0;
  const formatSelect = hasFormats
    ? `<select id="format">${options.formatOptions!.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}</select>`
    : '';
  const rowClass = hasFormats ? 'row row-two' : 'row';

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(options.title)}</title><style>${baseStyles()}</style>${turnstileScriptTag()}</head><body><div class="wrap"><div class="card"><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(options.description)}</p><form id="tool-form"><div class="${rowClass}"><input id="url" type="url" placeholder="https://example.com" required />${formatSelect}</div>${turnstileMarkup()}<button type="submit">${escapeHtml(options.buttonLabel)}</button></form></div><div class="card result"><div class="result-head"><div id="status" class="muted">No request yet.</div><button id="copy-btn" type="button" class="copy-btn">Copy</button></div><pre id="output">${escapeHtml(options.sample)}</pre></div></div><script>${renderTextToolScript(options)}</script></body></html>`;
}

export function renderScreenshotToolPage(options: ScreenshotToolOptions) {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(options.title)}</title><style>${baseStyles()} .row-three{grid-template-columns:1fr 1fr 180px}.toggle{display:flex;align-items:center;gap:10px;padding:14px 16px;border:1px solid #303030;border-radius:12px;background:#0f0f0f;color:#fafafa}.hidden{display:none}.image-wrap{margin-bottom:16px}.image-wrap img{max-width:100%;border-radius:16px;border:1px solid #262626;display:block}@media (max-width:720px){.row-three{grid-template-columns:1fr}}</style>${turnstileScriptTag()}</head><body><div class="wrap"><div class="card"><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(options.description)}</p><form id="tool-form"><div class="row row-two"><input id="url" type="url" placeholder="https://example.com" required /><select id="format"><option value="json">JSON</option><option value="jpeg">JPEG image</option><option value="png">PNG image</option></select></div><div class="row row-three"><input id="width" type="number" value="1440" min="320" max="2560" /><input id="height" type="number" value="900" min="320" max="2560" /><label class="toggle"><input id="fullPage" type="checkbox" /> Full page</label></div>${turnstileMarkup()}<button type="submit">Capture</button></form></div><div class="card result"><div class="result-head"><div id="status" class="muted">No request yet.</div><button id="copy-btn" type="button" class="copy-btn">Copy</button></div><div id="image-wrap" class="hidden image-wrap"><img id="preview" alt="Screenshot preview" /></div><pre id="output">${escapeHtml(options.sample)}</pre></div></div><script>${renderScreenshotToolScript(options)}</script></body></html>`;
}

function baseStyles() {
  return `:root{color-scheme:light dark}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;margin:0;background:#0a0a0a;color:#f5f5f5}.wrap{max-width:980px;margin:0 auto;padding:48px 20px}.card{background:#171717;border:1px solid #262626;border-radius:20px;padding:24px}h1{margin:0 0 8px;font-size:32px}p{color:#a3a3a3;line-height:1.6}form{display:grid;gap:12px;margin-top:20px}input,select,button{font:inherit}input,select{width:100%;background:#0f0f0f;color:#fafafa;border:1px solid #303030;border-radius:12px;padding:14px 16px;box-sizing:border-box}button{background:#fafafa;color:#111;border:0;border-radius:12px;padding:14px 18px;font-weight:600;cursor:pointer}.row{display:grid;gap:12px}.row-two{grid-template-columns:1fr 220px}.turnstile-wrap{display:grid;gap:8px}.turnstile-note{margin:0;color:#737373;font-size:12px}.result{margin-top:24px}.result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.copy-btn{background:#0f0f0f;color:#fafafa;border:1px solid #303030;border-radius:10px;padding:10px 12px;font-size:13px}.muted{color:#737373;font-size:13px}pre{margin:0;background:#0f0f0f;border:1px solid #262626;border-radius:16px;padding:16px;overflow:auto;white-space:pre-wrap;word-break:break-word}@media (max-width:720px){.row-two{grid-template-columns:1fr}}`;
}

function commonScriptPreamble(siteKey: string, endpoint: string) {
  return `${turnstileUiScript(siteKey)}const endpoint=${JSON.stringify(endpoint)};const form=document.getElementById('tool-form');const status=document.getElementById('status');const output=document.getElementById('output');const copyBtn=document.getElementById('copy-btn');copyBtn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(output.textContent||'');copyBtn.textContent='Copied';setTimeout(()=>copyBtn.textContent='Copy',1200);}catch{copyBtn.textContent='Failed';setTimeout(()=>copyBtn.textContent='Copy',1200);}});`;
}

function renderTextToolScript(options: TextToolOptions) {
  const modeLine = options.formatOptions?.length ? `const format=document.getElementById('format').value;` : `const format='json';`;
  const queryFormat = options.formatOptions?.length ? `query.format=format;` : ``;
  const pretty = options.formatOptions?.some((option) => option.value === 'markdown') ? `output.textContent=format==='json'?JSON.stringify(JSON.parse(text),null,2):text;` : `output.textContent=JSON.stringify(JSON.parse(text),null,2);`;

  return `${commonScriptPreamble(options.siteKey, options.endpoint)}form.addEventListener('submit',async(event)=>{event.preventDefault();const url=document.getElementById('url').value;${modeLine}if(!turnstileToken){status.textContent='Please complete the captcha.';return;}status.textContent='Running...';try{const query={url,'cf-turnstile-response':turnstileToken};${queryFormat}const response=await fetch(endpoint+'?'+new URLSearchParams(query));const text=await response.text();if(!response.ok) throw new Error(text||'Request failed');status.textContent='Done.';${pretty}if(window.turnstile&&turnstileWidgetId!==null){window.turnstile.reset(turnstileWidgetId);turnstileToken='';}}catch(error){status.textContent='Failed.';output.textContent=error.message||String(error);}});`;
}

function renderScreenshotToolScript(options: ScreenshotToolOptions) {
  return `${commonScriptPreamble(options.siteKey, options.endpoint)}const imageWrap=document.getElementById('image-wrap');const preview=document.getElementById('preview');form.addEventListener('submit',async(event)=>{event.preventDefault();const url=document.getElementById('url').value;const format=document.getElementById('format').value;const width=document.getElementById('width').value;const height=document.getElementById('height').value;const fullPage=document.getElementById('fullPage').checked?'true':'false';if(!turnstileToken){status.textContent='Please complete the captcha.';return;}status.textContent='Running...';try{const response=await fetch(endpoint+'?'+new URLSearchParams({url,format,width,height,fullPage,'cf-turnstile-response':turnstileToken}));if(format==='json'){const text=await response.text();if(!response.ok) throw new Error(text||'Request failed');imageWrap.classList.add('hidden');output.textContent=JSON.stringify(JSON.parse(text),null,2);}else{if(!response.ok) throw new Error(await response.text()||'Request failed');const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);preview.src=objectUrl;imageWrap.classList.remove('hidden');output.textContent=JSON.stringify({url,format,width,height,fullPage,preview:objectUrl},null,2);}status.textContent='Done.';if(window.turnstile&&turnstileWidgetId!==null){window.turnstile.reset(turnstileWidgetId);turnstileToken='';}}catch(error){status.textContent='Failed.';output.textContent=error.message||String(error);}});`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match));
}

export function turnstileSiteKeyFromEnv(env: { TURNSTILE_SITE_KEY?: string }) {
  return getTurnstileSiteKey(env);
}
