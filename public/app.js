// Veryeo site logic: loads site.json, fills prices/text, runs the order form, sends checkout to /api/checkout.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let S = null, money = null, plan = 'demo';
  const DRAFT = 'veryeo.draft';

  function fill() {
    const fmt = (c) => money.format(c / 100).replace(/\.00$/, '');
    $$('[data-price]').forEach((n) => { const p = S.plans[n.dataset.price]; if (p) n.textContent = fmt(p.priceCents); });
    $$('[data-turnaround]').forEach((n) => (n.textContent = S.turnaround));
    $$('[data-email]').forEach((n) => { n.textContent = S.contactEmail; n.href = 'mailto:' + S.contactEmail; });
    $$('[data-year]').forEach((n) => (n.textContent = new Date().getFullYear()));
    $$('[data-plan]').forEach((card) => {
      const p = S.plans[card.dataset.plan]; if (!p) return;
      $('[data-name]', card).textContent = p.name;
      $('[data-tagline]', card).textContent = p.tagline;
      const ul = $('[data-points]', card); ul.innerHTML = '';
      p.points.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    });
  }

  function setPlan(id) {
    plan = id === 'website' ? 'website' : 'demo';
    $$('[data-plan-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.planBtn === plan)));
    if ($('#totalLabel')) {
      $('#totalLabel').textContent = plan === 'demo' ? 'Demo total' : 'Website total';
      $('#totalPrice').textContent = money.format(S.plans[plan].priceCents / 100);
      $('#demoField').hidden = plan !== 'website';
    }
  }

  function form() {
    const f = $('#orderForm'); if (!f) return;
    const sel = $('#f-type'); sel.innerHTML = '';
    S.siteTypes.forEach((t) => { const o = document.createElement('option'); o.textContent = t; sel.appendChild(o); });
    // keep a draft in this browser so nothing is lost if they leave and come back
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || '{}'); for (const k in d) if (f.elements[k]) f.elements[k].value = d[k]; } catch (e) {}
    f.addEventListener('input', () => { try { localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (e) {} });
    $$('[data-plan-btn]').forEach((b) => (b.onclick = () => setPlan(b.dataset.planBtn)));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#msg'), btn = $('#payBtn'); msg.textContent = '';
      const brief = Object.fromEntries(new FormData(f));
      if (!brief.business.trim()) { msg.textContent = 'Please enter your business or project name.'; f.elements.business.focus(); return; }
      if (brief.details.trim().length < 10) { msg.textContent = 'Please tell us a little about the site you want.'; f.elements.details.focus(); return; }
      const label = btn.textContent; btn.disabled = true; btn.textContent = 'Loading…';
      try {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, brief }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) throw new Error(d.error || 'Checkout could not start. Please try again.');
        location.href = d.url;
      } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = label; }
    };
  }

  async function boot() {
    try { S = await (await fetch('/site.json', { cache: 'no-cache' })).json(); } catch (e) { return; }
    money = new Intl.NumberFormat('en-US', { style: 'currency', currency: S.currency.toUpperCase() });
    fill(); form();
    const want = new URLSearchParams(location.search).get('plan');
    setPlan(want || 'demo');
    $$('[data-pick]').forEach((a) => a.addEventListener('click', () => { if ($('#orderForm')) setPlan(a.dataset.pick); else a.href = '/?plan=' + a.dataset.pick + '#order'; }));
    if (new URLSearchParams(location.search).get('checkout') === 'cancelled' && $('#msg')) $('#msg').textContent = 'Checkout was cancelled. Your details are saved, so you can try again anytime.';
    if (/success\.html/.test(location.pathname) && new URLSearchParams(location.search).get('session_id')) { try { localStorage.removeItem(DRAFT); } catch (e) {} }
  }
  window.Site = { get: () => S };
  boot();
})();
