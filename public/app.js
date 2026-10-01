// Veryeo site logic: loads site.json, fills prices/text, runs the order form, sends checkout to /api/checkout.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let S = null, money = null, plan = 'demo';
  const DRAFT = 'veryeo.draft';

  function fill() {
    const fmt = (c) => money.format(c / 100).replace(/\.00$/, '');
    $$('[data-price]').forEach((n) => { const p = n.dataset.price === 'care' ? S.care : S.plans[n.dataset.price]; if (p) n.textContent = fmt(p.priceCents); });
    $$('[data-care-points]').forEach((ul) => { ul.innerHTML = ''; (S.care.points || []).forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); });
    if ($('#manageNote') && S.manageLink) { $('#manageNote').innerHTML = ' or <a href="' + S.manageLink + '" target="_blank" rel="noopener">manage your plan here</a>'; }
    $$('[data-email]').forEach((n) => { n.textContent = S.contactEmail; n.href = 'mailto:' + S.contactEmail; });
    $$('[data-year]').forEach((n) => (n.textContent = new Date().getFullYear()));
  }

  function setPlan(id) {
    plan = id === 'website' ? 'website' : 'demo';
    $$('[data-plan-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.planBtn === plan)));
    if ($('#totalLabel')) {
      const care = plan === 'website' && $('#f-care') && $('#f-care').checked;
      $('#totalLabel').textContent = plan === 'demo' ? 'Demo total' : care ? 'Due today, then ' + money.format(S.care.priceCents / 100).replace(/\.00$/, '') + '/month' : 'Website total';
      $('#totalPrice').textContent = money.format((S.plans[plan].priceCents + (care ? S.care.priceCents : 0)) / 100);
      $('#demoField').hidden = plan !== 'website';
      $('#careField').hidden = plan !== 'website';
      $('#careTerms').hidden = !care;
    }
  }

  function form() {
    const f = $('#orderForm'); if (!f) return;
    const sel = $('#f-type'); sel.innerHTML = '';
    S.siteTypes.forEach((t) => { const o = document.createElement('option'); o.textContent = t; sel.appendChild(o); });
    // keep a draft in this browser so nothing is lost if they leave and come back
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || '{}'); for (const k in d) if (f.elements[k] && k !== 'care') f.elements[k].value = d[k]; } catch (e) {}
    f.addEventListener('input', () => { try { localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (e) {} });
    $$('[data-plan-btn]').forEach((b) => (b.onclick = () => setPlan(b.dataset.planBtn)));
    if ($('#f-care')) $('#f-care').onchange = () => setPlan(plan);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#msg'), btn = $('#payBtn'); msg.textContent = '';
      const brief = Object.fromEntries(new FormData(f)); delete brief.care;
      const care = plan === 'website' && $('#f-care').checked;
      if (!brief.business.trim()) { msg.textContent = 'Please enter your business or project name.'; f.elements.business.focus(); return; }
      if (brief.details.trim().length < 10) { msg.textContent = 'Please tell us a little about the site you want.'; f.elements.details.focus(); return; }
      const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Loading…';
      try {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, care, brief }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) throw new Error(d.error || 'Checkout could not start. Please try again.');
        location.href = d.url;
      } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.innerHTML = label; }
    };
  }

  // hero showcase: 4 sample homepages shown as scaled live pages
  function showcase() {
    const screen = $('#screen'), frame = $('#sampleFrame'); if (!screen || !frame) return;
    const tabs = $$('[data-sample]');
    const fit = () => { frame.style.transform = 'scale(' + screen.clientWidth / 1280 + ')'; };
    fit(); if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screen); else addEventListener('resize', fit);
    let i = 0, timer = null, touched = false;
    const show = (n) => {
      i = n; const t = tabs[n];
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b === t)));
      frame.src = '/samples/' + t.dataset.sample + '.html';
      $('#sampleUrl').textContent = t.dataset.url;
      $('#sampleOpen').href = '/samples/' + t.dataset.sample + '.html';
    };
    tabs.forEach((b, n) => (b.onclick = () => { touched = true; clearInterval(timer); show(n); }));
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) timer = setInterval(() => { if (!touched && !document.hidden) show((i + 1) % tabs.length); }, 6000);
  }

  async function boot() {
    try { S = await (await fetch('/site.json', { cache: 'no-cache' })).json(); } catch (e) { return; }
    money = new Intl.NumberFormat('en-US', { style: 'currency', currency: S.currency.toUpperCase() });
    fill(); form(); showcase();
    const want = new URLSearchParams(location.search).get('plan');
    setPlan(want || 'demo');
    $$('[data-pick]').forEach((a) => a.addEventListener('click', () => { if ($('#orderForm')) setPlan(a.dataset.pick); else a.href = '/?plan=' + a.dataset.pick + '#order'; }));
    if (new URLSearchParams(location.search).get('checkout') === 'cancelled' && $('#msg')) $('#msg').textContent = 'Checkout was cancelled. Your details are saved, so you can try again anytime.';
    if (/success\.html/.test(location.pathname) && new URLSearchParams(location.search).get('session_id')) { try { localStorage.removeItem(DRAFT); } catch (e) {} }
  }
  window.Site = { get: () => S };
  boot();
})();
