const DEFAULT_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
const DEFAULT_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

type TurnstileEnv = {
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export function getTurnstileSiteKey(env?: TurnstileEnv) {
  return env?.TURNSTILE_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY;
}

export async function verifyTurnstileToken(
  env: TurnstileEnv | undefined,
  token: string | null | undefined,
  remoteip?: string | null,
) {
  if (!token) {
    return { ok: false, error: "Missing captcha token." };
  }

  const form = new FormData();
  form.set("secret", env?.TURNSTILE_SECRET_KEY || DEFAULT_TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false, error: "Captcha verification failed." };
  }

  const payload = await response.json<any>().catch(() => null);
  if (!payload?.success) {
    return { ok: false, error: "Captcha verification failed." };
  }

  return { ok: true as const };
}

export function readTurnstileTokenFromUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  return url.searchParams.get("cf-turnstile-response");
}

export function turnstileScriptTag() {
  return `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>`;
}

export function turnstileUiScript(siteKey: string) {
  return `const turnstileSiteKey=${JSON.stringify(siteKey)};let turnstileToken='';let turnstileWidgetId=null;function ensureTurnstile(){if(!window.turnstile||turnstileWidgetId!==null)return;turnstileWidgetId=window.turnstile.render('#turnstile-container',{sitekey:turnstileSiteKey,theme:'dark',callback:(token)=>{turnstileToken=token;},'expired-callback':()=>{turnstileToken='';},'error-callback':()=>{turnstileToken='';}});}window.addEventListener('load',()=>{const wait=()=>{if(window.turnstile){ensureTurnstile();}else{setTimeout(wait,150);}};wait();});`;
}

export function turnstileMarkup() {
  return `<div class="turnstile-wrap"><div id="turnstile-container"></div><p class="turnstile-note">Protected by Cloudflare Turnstile</p></div>`;
}
