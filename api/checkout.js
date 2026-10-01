// POST /api/checkout  body: { plan: "demo"|"website", brief: {...} }
// Prices always come from site.json on the server, never from the browser.
const site = require('../public/site.json');
const { stripe, origin } = require('../lib/stripe');

const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const planId = body.plan === 'website' ? 'website' : body.plan === 'demo' ? 'demo' : null;
    if (!planId) return res.status(400).json({ error: 'Please choose a plan.' });
    const plan = site.plans[planId];
    const b = body.brief || {};
    const brief = {
      business: clip(b.business, 120),
      type: site.siteTypes.includes(b.type) ? b.type : 'Other',
      details: clip(b.details, 480),
      link: clip(b.link, 300),
      style: clip(b.style, 300),
      demo_order: clip(b.demoOrder, 40),
    };
    if (!brief.business) return res.status(400).json({ error: 'Please enter your business or project name.' });
    if (brief.details.length < 10) return res.status(400).json({ error: 'Please tell us a little about the site you want.' });

    const url = origin(req);
    // Saved on the Stripe payment so every order's details show in your dashboard.
    const metadata = { site: 'veryeo', plan: planId, ...Object.fromEntries(Object.entries(brief).filter(([, v]) => v)) };
    const params = {
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: site.currency,
          unit_amount: plan.priceCents,
          product_data: { name: `${site.brand} ${plan.name}`, description: plan.tagline, metadata: { plan: planId } },
        },
      }],
      customer_creation: 'always',
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      metadata,
      payment_intent_data: { description: `${site.brand} ${plan.name}: ${brief.business}`, metadata },
      custom_text: { submit: { message: planId === 'demo'
        ? `We'll email your demo ${site.turnaround}.`
        : "We'll email you to start your website. Bought a demo? Enter the code from your demo email above." } },
      success_url: url + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: url + '/?checkout=cancelled#order',
    };
    if (planId === 'website') params.allow_promotion_codes = true;
    const session = await stripe('POST', '/checkout/sessions', params);
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error(e);
    let hint = 'Checkout could not start. Please try again.';
    if (/STRIPE_SECRET_KEY is not set/.test(e.message)) hint = 'Payments are not set up yet (Stripe key missing on the server).';
    else if (e.status === 401) hint = 'Payments are not set up correctly (Stripe key was rejected).';
    return res.status(e.status && e.status < 500 ? 400 : 500).json({ error: hint });
  }
};
