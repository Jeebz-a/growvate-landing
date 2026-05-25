/**
 * /api/contact — Growvate contact form → Resend email
 *
 * Receives a POST from the homepage "Send the brief" form, sanitises the
 * payload, and sends a formatted email to the team inbox via the Resend
 * REST API. No SDK needed — Vercel's Node 20 runtime has native fetch.
 *
 * Required Vercel env var: RESEND_API_KEY
 * Optional env vars:
 *   RESEND_FROM   — defaults to "Growvate <onboarding@resend.dev>"
 *                   (after you verify growvate.com in Resend you can switch
 *                    this to e.g. "Growvate <hello@growvate.com>")
 *   RESEND_TO     — defaults to "growvatestudio@gmail.com"
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

  // Honeypot — if filled, silently accept and bin
  if ((body.website || '').toString().trim() !== '') {
    return res.status(200).json({ ok: true });
  }

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
        From ${esc(referer || '—')}
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
