/**
 * /api/contact — Growvate contact form → Resend email
 *
 * Receives a POST from the contact form, sanitises the payload, runs anti-
 * spam filters (server-side content rules + optional Cloudflare Turnstile),
 * and sends a formatted email to the team inbox via the Resend REST API.
 *
 * Required Vercel env var:
 *   RESEND_API_KEY
 *
 * Optional env vars:
 *   RESEND_FROM        defaults to "Growvate <onboarding@resend.dev>"
 *                      (switch to a verified-domain address once growvate.com
 *                      is verified in Resend)
 *   RESEND_TO          defaults to "growvatestudio@gmail.com"
 *   TURNSTILE_SECRET   if set, every submission must pass Cloudflare
 *                      Turnstile verification (token in `cf-turnstile-response`)
 *                      Get one at https://dash.cloudflare.com/?to=/:account/turnstile
 */

const TO_DEFAULT = 'growvatestudio@gmail.com';
const FROM_DEFAULT = 'Growvate Contact <onboarding@resend.dev>';

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ─── Spam filters ────────────────────────────────────────────────
// Rules tuned to block the patterns we actually see from spammers,
// without blocking legit users who happen to mention a tool or URL.

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const T_ME_RE = /\bt\.me\/[^\s]+/gi;

// High-signal spam phrases — if even one shows up, very likely spam.
// Kept tight on purpose; we'd rather miss a few and never block legit users.
const SPAM_PHRASES = [
  'backlinks',
  'guest post',
  'guest posting',
  'link insertion',
  'link building',
  'do-follow link',
  'dofollow link',
  'pbn',
  'rank #1',
  'rank your site',
  'rank your website',
  'seo services',
  'seo expert',
  'seo offer',
  'seo company',
  'cheap seo',
  'monthly seo',
  'wordpress plugin',
  'crypto investment',
  'cryptocurrency invest',
  'forex trading',
  'binary options',
  'bitcoin trading',
  'casino',
  'viagra',
  'cialis',
  'kindly reply',
  'kindly revert',
  'best regards',  // dead giveaway in a "brief" textarea
  'esteemed',
  'humble request',
  'dear sir/madam',
  'dear sir or madam',
  'dear webmaster',
  'mass email',
  'bulk email',
  'email marketing services',
  'lead generation services',
  'web development services',
  'web design services',
  'mobile app development services',
  'we are a company',
  'we are a leading',
  'we provide',
  'we offer',
  'our company offers',
  'our services include',
  'let me know if you are interested',
  'are you interested',
  'whatsapp',
  'send me your skype',
  'telegram',
  'click the link',
  'check our website',
  'visit our website',
  'i can offer you',
  'increase your traffic',
  'increase your sales',
  'boost your ranking',
  'investment opportunity',
];

// Words that, by themselves, don't mean spam — but if the brief is mostly
// these terms with a URL, very likely promo spam.
function hasUrl(str = '') {
  URL_RE.lastIndex = 0;
  return URL_RE.test(str) || T_ME_RE.test(str);
}

function countUrls(str = '') {
  URL_RE.lastIndex = 0;
  const m = str.match(URL_RE);
  return m ? m.length : 0;
}

function containsSpamPhrase(str = '') {
  const lower = String(str).toLowerCase();
  for (const phrase of SPAM_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

// True if any string field contains non-ASCII Cyrillic / Arabic / CJK at a
// high ratio while the email is plain ASCII — typical of bulk spam from
// localised templates.
function looksMostlyForeignScript(str = '') {
  if (!str) return false;
  const total = str.replace(/\s/g, '').length;
  if (total < 20) return false;
  const foreign = (str.match(/[Ѐ-ӿ֐-׿؀-ۿ぀-ヿ㐀-鿿]/g) || []).length;
  return foreign / total > 0.4;
}

/**
 * Returns { blocked: bool, reason: string|null }
 * Reason is logged server-side and never returned to the client (we always
 * tell the client "thanks!" to avoid giving spammers a tuning signal).
 */
function runSpamFilters({ name, email, company, brief }) {
  // Brief almost always contains the giveaway in our spam samples
  const fullText = [name, company, brief].join(' \n ');

  // 1) URLs anywhere in name/company are almost always spam
  if (hasUrl(name) || hasUrl(company)) {
    return { blocked: true, reason: 'url in name/company' };
  }

  // 2) Multiple URLs in brief — legit users rarely paste 2+ links
  if (countUrls(brief) >= 2) {
    return { blocked: true, reason: 'multiple urls in brief' };
  }

  // 3) Any URL in brief + any spam phrase = block (catches "Check out https://… for SEO services")
  if (hasUrl(brief) && containsSpamPhrase(fullText)) {
    return { blocked: true, reason: 'url + spam phrase in brief' };
  }

  // 4) Telegram handle anywhere is a strong spam signal
  if (T_ME_RE.test(fullText)) {
    return { blocked: true, reason: 'telegram handle' };
  }

  // 5) High-confidence spam phrase in name (legit users don't put "SEO services" as their name)
  const namePhrase = containsSpamPhrase(name);
  if (namePhrase) return { blocked: true, reason: `spam phrase in name: ${namePhrase}` };

  // 6) Two or more spam phrases anywhere = block
  let phraseHits = 0;
  for (const phrase of SPAM_PHRASES) {
    if (fullText.toLowerCase().includes(phrase)) phraseHits++;
    if (phraseHits >= 2) {
      return { blocked: true, reason: 'multiple spam phrases' };
    }
  }

  // 7) Brief is mostly non-Latin script while email is plain ASCII —
  //    typical of bulk localised spam
  if (brief && looksMostlyForeignScript(brief) && /^[\x00-\x7F]+$/.test(email)) {
    return { blocked: true, reason: 'mostly foreign script in brief' };
  }

  // 8) Brief is a single line with no spaces and longer than 200 chars (blob spam)
  if (brief && brief.length > 200 && !brief.includes(' ') && !brief.includes('\n')) {
    return { blocked: true, reason: 'wall of no-space text' };
  }

  return { blocked: false, reason: null };
}

/**
 * Verify a Cloudflare Turnstile token. Returns true if the env var isn't
 * set (graceful no-op during setup) or if verification passes.
 */
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'missing token' };

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: data.success === true, error: data['error-codes']?.join(',') || null };
  } catch (err) {
    console.error('[contact] Turnstile verify failed', err);
    // If Cloudflare is unreachable, fail closed — better to drop a few real
    // leads briefly than to open the floodgates to spam.
    return { ok: false, error: 'verify request failed' };
  }
}

export default async function handler(req, res) {
  // CORS for safety (same-origin in production, but harmless to set)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY not set');
    return res
      .status(500)
      .json({ ok: false, error: 'Email service not configured' });
  }

  // Body comes in as already-parsed JSON on Vercel for application/json
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name    = (body.name    || '').toString().trim().slice(0, 200);
  const email   = (body.email   || '').toString().trim().slice(0, 200);
  const company = (body.company || '').toString().trim().slice(0, 200);
  const need    = (body.need    || '').toString().trim().slice(0, 200);
  const budget  = (body.budget  || '').toString().trim().slice(0, 100);
  const brief   = (body.brief   || '').toString().trim().slice(0, 5000);
  const referer = (req.headers['referer'] || '').toString().slice(0, 500);
  const ua      = (req.headers['user-agent'] || '').toString().slice(0, 500);
  const ip      = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  const turnstileToken = (body['cf-turnstile-response'] || body.turnstileToken || '').toString();

  // ── ANTI-SPAM LAYER 1: Honeypot ───────────────────────────────
  // If the hidden "website" field is filled, a bot did it. Return success
  // silently so the spammer doesn't learn anything; just don't send the email.
  if ((body.website || '').toString().trim() !== '') {
    console.warn('[contact] honeypot tripped', { ip, ua: ua.slice(0, 80) });
    return res.status(200).json({ ok: true });
  }

  // ── ANTI-SPAM LAYER 2: Server-side content filters ───────────
  // Blocks the spam patterns we've actually been receiving.
  const filterResult = runSpamFilters({ name, email, company, brief });
  if (filterResult.blocked) {
    console.warn('[contact] content filter blocked', { reason: filterResult.reason, ip, email: email.slice(0, 40) });
    // Tell the client it succeeded (so we don't help spammers tune their attack).
    return res.status(200).json({ ok: true });
  }

  // ── ANTI-SPAM LAYER 3: Cloudflare Turnstile (only if configured) ──
  const ts = await verifyTurnstile(turnstileToken, ip);
  if (!ts.ok) {
    console.warn('[contact] turnstile failed', { error: ts.error, ip });
    return res.status(403).json({ ok: false, error: 'Captcha verification failed. Please refresh and try again.' });
  }

  // ── Field validation ─────────────────────────────────────────
  if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
  if (!isEmail(email)) return res.status(400).json({ ok: false, error: 'Valid email required' });
  if (!need) return res.status(400).json({ ok: false, error: 'Please pick a lane' });

  const subject = `✦ New brief from ${name}${company ? ' — ' + company : ''}`;
  const submittedAt = new Date().toISOString();

  // Plain-text fallback
  const text = [
    'A new brief just came in from growvate.com.',
    '',
    'Name:     ' + (name    || '—'),
    'Email:    ' + (email   || '—'),
    'Company:  ' + (company || '—'),
    'Need:     ' + (need    || '—'),
    'Budget:   ' + (budget  || '— (not provided)'),
    '',
    'Brief:',
    brief || '(no brief provided)',
    '',
    '—',
    'Submitted: ' + submittedAt,
    'Referrer:  ' + (referer || '—'),
    'UA:        ' + (ua || '—'),
    'IP:        ' + (ip || '—'),
    'Turnstile: ' + (ts.skipped ? 'not configured' : 'verified'),
  ].join('\n');

  // HTML version — clean, readable in Gmail/Apple Mail
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f5f1ea;border-radius:14px;">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#FF5A1F;margin-bottom:8px;">Growvate · New brief</div>
      <h1 style="font-size:22px;margin:0 0 18px;">${esc(name)}${company ? ` <span style="color:#6b6b6b;font-weight:400;">— ${esc(company)}</span>` : ''}</h1>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b6b6b;width:90px;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}" style="color:#0d0d0d;">${esc(email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Company</td><td style="padding:6px 0;">${esc(company) || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Need</td><td style="padding:6px 0;"><strong>${esc(need)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Budget</td><td style="padding:6px 0;">${budget ? `<strong>${esc(budget)}</strong>` : '<em style="color:#9a9a9a;">not provided</em>'}</td></tr>
      </table>

      ${brief ? `
      <div style="background:#fff;padding:16px 18px;border-radius:10px;border:1px solid rgba(0,0,0,.06);font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(brief)}</div>
      ` : `<div style="color:#6b6b6b;font-size:13px;font-style:italic;">No brief provided.</div>`}

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(0,0,0,.08);font-size:11px;color:#9a9a9a;">
        Submitted ${esc(submittedAt)}<br/>
        From ${esc(referer || '—')}<br/>
        Anti-spam: honeypot ✓ · content filters ✓ · turnstile ${ts.skipped ? '— (not configured)' : '✓'}
      </div>
    </div>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || FROM_DEFAULT,
        to: [process.env.RESEND_TO || TO_DEFAULT],
        reply_to: email,
        subject,
        html,
        text,
      }),
    });

    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('[contact] Resend error:', resendRes.status, data);
      return res.status(502).json({
        ok: false,
        error: 'Email service returned an error',
        detail: data?.message || data?.name || `HTTP ${resendRes.status}`,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[contact] Send failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send' });
  }
}
