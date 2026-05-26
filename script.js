/* ============================================================
   Growvate — landing motion (AI studio)
   GSAP + ScrollTrigger + Lenis smooth scroll
   ============================================================ */

// ─── CONFIG ──────────────────────────────────────────────────
// Paste your deployed Google Apps Script Web App URL here.
// (See GOOGLE_SHEETS_SETUP.md for the 2-minute setup.)
const LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyyqvDNigBkwmvqGbp2xhKXSu3Jf4TSwLPztxdoSd1wcBwBbIN_z_9l3aT_kgLaOrY/exec';
// ─────────────────────────────────────────────────────────────

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Send a captured lead to the configured Google Sheets endpoint.
 * Uses text/plain so the request stays a "simple" CORS request
 * (no preflight needed against Apps Script).
 */
function sendLead(data) {
  if (!LEAD_ENDPOINT || LEAD_ENDPOINT.startsWith('PASTE_')) {
    console.warn('[Growvate] LEAD_ENDPOINT not configured — skipping remote send. See GOOGLE_SHEETS_SETUP.md');
    return Promise.resolve({ ok: false, reason: 'not-configured' });
  }
  return fetch(LEAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
    redirect: 'follow',
    keepalive: true,
  }).catch((err) => {
    console.error('[Growvate] Lead send failed:', err);
    return { ok: false, reason: 'network', error: err };
  });
}

/* ───────── lenis smooth scroll ──────── */
const lenis = new Lenis({
  duration: 1.15,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ───────── helpers ──────── */
function wrapSplits() {
  document.querySelectorAll('.split').forEach((el) => {
    if (el.dataset.wrapped) return;
    el.dataset.wrapped = '1';
    el.innerHTML = `<span>${el.innerHTML}</span>`;
  });
}

/* ───────── hero entrance ──────── */
function heroEntrance() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.kicker', { y: 18, opacity: 0, duration: .9 }, 0)
    .from('.hero__title .split > span', { yPercent: 110, duration: 1.1, stagger: .09 }, .1)
    .from('.hero__lede',  { y: 22, opacity: 0, duration: 1.0 }, .55)
    .from('.hero__cta > *', { y: 20, opacity: 0, duration: .9, stagger: .07 }, .7)
    .from('.hero__proof',   { y: 20, opacity: 0, duration: .8 }, .85)
    // hero right elements
    .from('.orbit__core',   { scale: .6, opacity: 0, duration: 1.0, ease: 'back.out(1.6)' }, .3)
    .from('.orbit__ring',   { scale: .6, opacity: 0, duration: 1.0, stagger: .08 }, .45)
    .from('.orbit__node',   { y: 14, opacity: 0, duration: .8, stagger: .08 }, .7)
    .from('.card',          { y: 24, opacity: 0, duration: .9, stagger: .12 }, .8);
}

/* ───────── section title reveals ──────── */
function sectionTitles() {
  document.querySelectorAll('.section__title, .cta__title, .testimonial__quote').forEach((title) => {
    gsap.from(title.querySelectorAll('.split > span'), {
      yPercent: 110,
      duration: 1.1,
      stagger: .08,
      ease: 'expo.out',
      scrollTrigger: { trigger: title, start: 'top 85%' },
    });
  });
}

/* ───────── generic reveal-up ──────── */
function genericReveals() {
  document.querySelectorAll('.reveal-up').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-in'),
    });
  });
}

/* ───────── stat counters (handles decimals, uses IntersectionObserver) ──────── */
function counters() {
  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split('.')[1] || '').length;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = decimals ? obj.v.toFixed(decimals) : Math.round(obj.v);
      },
    });
  };

  const els = document.querySelectorAll('[data-count]');
  if (!('IntersectionObserver' in window)) {
    els.forEach(animate);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

  els.forEach((el) => {
    // animate immediately if already in viewport on load
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      animate(el);
    } else {
      io.observe(el);
    }
  });
}

/* ───────── pain items stagger ──────── */
function painReveal() {
  const items = document.querySelectorAll('.pain__list li');
  if (!items.length) return;
  // .fromTo with explicit end state — defensive against ScrollTrigger
  // misfiring under Lenis. Even if trigger never fires, the items
  // can't get stuck at opacity:0.
  gsap.fromTo(items,
    { x: 30, opacity: 0 },
    {
      x: 0, opacity: 1,
      duration: .7,
      stagger: .07,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.pain__list', start: 'top 85%', once: true },
    }
  );
}

/* ───────── bento cells stagger ──────── */
function bentoReveal() {
  gsap.fromTo('.bento__cell',
    { y: 40, opacity: 0 },
    {
      y: 0, opacity: 1,
      duration: .9,
      stagger: .1,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.bento', start: 'top 85%', once: true },
    }
  );
}

/* ───────── case parallax ──────── */
function caseParallax() {
  document.querySelectorAll('.case').forEach((card) => {
    const media = card.querySelector('.case__media');
    if (!media) return;
    gsap.fromTo(media,
      { y: 0 },
      {
        y: -30, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
      });
  });
}

/* ───────── interactive bar chart ──────── */
function chart() {
  const chart = document.getElementById('chart');
  const cbars = document.getElementById('cbars');
  if (!chart || !cbars) return;
  const valueEl = chart.querySelector('.chart__value');
  const monthEl = chart.querySelector('.chart__month');
  const deltaEl = chart.querySelector('.chart__delta');
  const barEls  = [...cbars.querySelectorAll('.cbar')];

  const defaultValue = '580h';
  const defaultMonth = 'May 2026 · current';
  const defaultDelta = '↑ 22% MoM';

  // grow bars from baseline when in view
  ScrollTrigger.create({
    trigger: chart,
    start: 'top 82%',
    once: true,
    onEnter: () => cbars.classList.add('is-drawn'),
  });

  // hover/scrub per bar
  const setActive = (idx) => {
    barEls.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    const b = barEls[idx];
    valueEl.textContent = b.dataset.v + 'h';
    monthEl.textContent = `${b.dataset.l} ${b.dataset.y}`;
    // MoM delta vs previous bar
    if (idx > 0) {
      const prev = parseFloat(barEls[idx - 1].dataset.v);
      const curr = parseFloat(b.dataset.v);
      const pct  = ((curr - prev) / prev) * 100;
      deltaEl.textContent = (pct >= 0 ? '↑ ' : '↓ ') + Math.abs(pct).toFixed(1) + '% MoM';
    } else {
      deltaEl.textContent = '— baseline';
    }
  };

  barEls.forEach((b, i) => {
    b.addEventListener('mouseenter', () => setActive(i));
    b.addEventListener('focus', () => setActive(i));
  });
  cbars.addEventListener('mouseleave', () => {
    barEls.forEach((b) => b.classList.remove('is-active'));
    valueEl.textContent = defaultValue;
    monthEl.textContent = defaultMonth;
    deltaEl.textContent = defaultDelta;
  });
}

/* ───────── calendar mock slot picker ──────── */
function calendarMock() {
  document.querySelectorAll('.cal__slot').forEach((slot) => {
    slot.addEventListener('click', () => {
      document.querySelectorAll('.cal__slot').forEach((s) => s.classList.remove('is-on'));
      slot.classList.add('is-on');
    });
  });
  document.querySelectorAll('.cal__mock-grid > i:not(.is-pad)').forEach((day) => {
    day.addEventListener('click', () => {
      document.querySelectorAll('.cal__mock-grid > i').forEach((d) => d.classList.remove('is-on'));
      day.classList.add('is-on');
    });
  });
}

/* ───────── FAQ accordion (animated) ──────── */
function faq() {
  document.querySelectorAll('.faq__item').forEach((item) => {
    const summary = item.querySelector('summary');
    const content = item.querySelector('p');
    if (!summary || !content) return;

    // animate open state on initial load if already [open]
    if (item.open) {
      content.style.height = 'auto';
    } else {
      content.style.height = '0px';
      content.style.overflow = 'hidden';
      content.style.opacity = '0';
    }

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = !item.open;
      if (willOpen) {
        item.open = true;
        const h = content.scrollHeight;
        gsap.fromTo(content,
          { height: 0, opacity: 0, marginTop: 0 },
          { height: h, opacity: 1, marginTop: 16, duration: .5, ease: 'expo.out',
            onComplete: () => { content.style.height = 'auto'; } });
      } else {
        const h = content.scrollHeight;
        gsap.fromTo(content,
          { height: h, opacity: 1, marginTop: 16 },
          { height: 0, opacity: 0, marginTop: 0, duration: .35, ease: 'expo.in',
            onComplete: () => { item.open = false; } });
      }
    });
  });
}

/* ───────── nav scroll + anchor links via lenis ──────── */
function nav() {
  const navEl = document.querySelector('.nav');
  ScrollTrigger.create({
    start: 'top -10',
    end: 99999,
    onUpdate: (self) => navEl.classList.toggle('is-scrolled', self.scroll() > 10),
  });

  const toggle = navEl.querySelector('.nav__toggle');
  toggle.addEventListener('click', () => {
    const open = navEl.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = id === '#top' ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      navEl.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    });
  });
}

/* ───────── custom cursor ──────── */
function cursor() {
  if (window.matchMedia('(hover: none)').matches) return;
  const cur = document.querySelector('.cursor');
  const dot = cur.querySelector('.cursor__dot');
  const ring = cur.querySelector('.cursor__ring');

  const mouse = { x: 0, y: 0 };
  const ringPos = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;
  });
  gsap.ticker.add(() => {
    ringPos.x += (mouse.x - ringPos.x) * 0.18;
    ringPos.y += (mouse.y - ringPos.y) * 0.18;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`;
  });
  document.querySelectorAll('a, button, [data-link], .service, .case, .post, input, summary').forEach((el) => {
    el.addEventListener('mouseenter', () => cur.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => cur.classList.remove('is-hover'));
  });
}

/* ───────── resources gate modal ──────── */
function resourceGate() {
  const modal = document.getElementById('resourceModal');
  if (!modal) return;
  const form     = modal.querySelector('#resourceForm');
  const success  = modal.querySelector('#resourceSuccess');
  const titleEl  = modal.querySelector('#resourceModalTitle');
  const summaryEl= modal.querySelector('#resourceModalSummary');
  const headingEl= modal.querySelector('#resourceModalHeading');
  const subEl    = modal.querySelector('#resourceModalSub');
  const ctaEl    = modal.querySelector('#resourceModalCta');
  const successH = modal.querySelector('#resourceSuccessH');
  const successP = modal.querySelector('#resourceSuccessP');

  let currentFile = null;
  let currentFilename = null;
  let currentCategory = '';
  let currentMode = 'download';

  const open = (cfg) => {
    currentFile = cfg.file || null;
    currentFilename = cfg.filename || null;
    currentCategory = cfg.category || '';
    currentMode = cfg.mode || 'download';
    titleEl.textContent = cfg.title || 'Free guide';
    summaryEl.textContent = cfg.summary || '';

    if (currentMode === 'notify') {
      headingEl.textContent = 'Get notified when it drops';
      subEl.textContent = `Drop your details and we'll email you the moment "${cfg.title}" goes live.`;
      ctaEl.textContent = 'Notify me';
    } else {
      headingEl.textContent = 'Get the PDF';
      subEl.textContent = "Tell us where to send it — we'll start the download now and email you a copy too.";
      ctaEl.textContent = 'Download PDF';
    }

    form.hidden = false;
    success.hidden = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('is-open'));
    // focus first input
    setTimeout(() => form.querySelector('input[name="name"]')?.focus(), 220);
    // pause lenis scroll while modal is open
    if (typeof lenis !== 'undefined') lenis.stop?.();
  };

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      form.reset();
      if (typeof lenis !== 'undefined') lenis.start?.();
    }, 320);
  };

  // open buttons (delegated to ensure dynamic content works too)
  document.querySelectorAll('[data-open-resource]').forEach((btn) => {
    btn.addEventListener('click', () => {
      open({
        file: btn.dataset.file,
        filename: btn.dataset.filename,
        title: btn.dataset.title,
        category: btn.dataset.category,
        summary: btn.dataset.summary,
        mode: btn.dataset.mode,
      });
    });
  });

  // conditional company-name field (revealed when "A business" is picked)
  const companyField = modal.querySelector('#modalCompanyField');
  const companyInput = companyField ? companyField.querySelector('input[name="companyName"]') : null;
  const syncCompany = () => {
    if (!companyField || !companyInput) return;
    const isBusiness = (form.elements['useType'] && form.elements['useType'].value) === 'business';
    companyField.classList.toggle('is-shown', isBusiness);
    companyField.setAttribute('aria-hidden', String(!isBusiness));
    companyInput.required = isBusiness;
    if (!isBusiness) companyInput.value = '';
  };
  form.querySelectorAll('input[name="useType"]').forEach((r) => r.addEventListener('change', syncCompany));
  // also re-sync after open/reset (called below from close())
  form.addEventListener('reset', () => setTimeout(syncCompany, 0));
  syncCompany();

  // close triggers
  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  // form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    data.resource = titleEl.textContent;
    data.category = currentCategory;
    data.mode = currentMode;
    data.timestamp = new Date().toISOString();
    data.userAgent = navigator.userAgent;

    // store in localStorage as a lightweight lead log (placeholder for real backend)
    try {
      const leads = JSON.parse(localStorage.getItem('growvate_leads') || '[]');
      leads.push(data);
      localStorage.setItem('growvate_leads', JSON.stringify(leads));
    } catch (_) { /* ignore quota errors */ }

    // dev visibility
    console.log('[Growvate · lead captured]', data);

    // ship to Google Sheets (fire-and-forget; download still triggers regardless)
    sendLead(data);

    // trigger PDF download (only in download mode)
    if (currentMode !== 'notify' && currentFile) {
      const a = document.createElement('a');
      a.href = currentFile;
      a.download = currentFilename || '';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // success state
    if (currentMode === 'notify') {
      successH.textContent = "You're on the list ✦";
      successP.textContent = `We'll email you the moment "${data.resource}" goes live. No spam — just the guide.`;
    } else {
      successH.textContent = 'Downloading now ✦';
      successP.textContent = "Your guide is on its way. Keep an eye on your inbox — we'll email the link too.";
    }
    form.hidden = true;
    success.hidden = false;
  });
}

/* ───────── boot ──────── */
function kickoff() {
  document.body.classList.add('js-ready');
  wrapSplits();
  if (!prefersReduced) {
    // Hero elements have .reveal-up for graceful no-JS fallback, but their
    // entrance is owned by the GSAP timeline below. Strip the class + any
    // inline state so GSAP can measure them at opacity:1 / transform:none.
    // (Otherwise the .8s CSS transition on .reveal-up is mid-flight when
    // GSAP reads, GSAP records ~0 as the TO state, and the animation stalls.)
    document.querySelectorAll('.hero .reveal-up').forEach(el => {
      el.classList.remove('reveal-up');
      el.style.opacity = '';
      el.style.transform = '';
      el.style.transition = 'none';
    });
    heroEntrance();
    sectionTitles();
    caseParallax();
    painReveal();
    bentoReveal();
  } else {
    document.querySelectorAll('.split > span, .reveal-up').forEach(s => { s.style.transform = 'none'; s.style.opacity = '1'; });
  }
  genericReveals();
  counters();
  faq();
  chart();
  calendarMock();
  resourceGate();
  contactFormResend();
  // ensure any elements already in view get revealed immediately
  setTimeout(() => ScrollTrigger.refresh(), 60);
}

/* ───────── contact form → Resend ──────── */
function contactFormResend() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const success = document.getElementById('formSent');
  const errorEl = document.getElementById('formError');
  const errorMsg = document.getElementById('formErrorMsg');
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitLabel = submitBtn ? submitBtn.querySelector('span') : null;
  const originalLabel = submitLabel ? submitLabel.textContent : 'Send the brief';

  const setError = (msg) => {
    if (!errorEl) return;
    if (msg && errorMsg) {
      errorMsg.innerHTML = msg + ' Or email <a href="mailto:growvatestudio@gmail.com">growvatestudio@gmail.com</a> directly.';
    }
    errorEl.hidden = false;
  };
  const clearError = () => { if (errorEl) errorEl.hidden = true; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form));

    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Sending…';
    form.classList.add('is-sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      let payload = {};
      try { payload = await res.json(); } catch (_) { /* non-JSON */ }

      if (!res.ok || !payload.ok) {
        const reason = (payload && payload.error) ? payload.error : `Request failed (${res.status}).`;
        throw new Error(reason);
      }

      form.style.opacity = '0.6';
      if (success) success.hidden = false;
      // collapse the form inputs into a quiet "received" state
      form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      console.log('[Growvate · brief sent]', payload.id || '');
    } catch (err) {
      console.error('[Growvate · brief send failed]', err);
      setError(err && err.message ? String(err.message) : 'Please try again in a moment.');
      if (submitBtn) submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = originalLabel;
      form.classList.remove('is-sending');
    }
  });
}

nav();
cursor();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', kickoff, { once: true });
} else {
  kickoff();
}
