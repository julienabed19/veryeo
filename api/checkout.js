// POST /api/checkout body: { plan: "demo"|"website", brief: {...} }
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
      phone: clip(b.phone, 30),
      type: site.siteTypes.includes(b.type) ? b.type : 'Other',
      details: clip(b.details, 480),
      link: clip(b.link, 300),
      style: clip(b.style, 300),
      demo_order: clip(b.demoOrder, 40),
    };
    if (!brief.business) return res.status(400).json({ error: 'Please enter your business or project name.' });
    if (brief.phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Please enter a phone number we can reach you at.' });
    if (brief.details.length < 10) return res.status(400).json({ error: 'Please tell us a little about the site you want.' });

    const care = planId === 'website'; // hosting & care is part of every full website
    if (care && body.agree !== true) return res.status(400).json({ error: 'Please check the box to agree to the $30/month hosting & care plan.' });
    const url = origin(req);
    // Saved on the Stripe payment so every order's details show in your dashboard.
    const metadata = { site: 'veryeo', plan: planId, ...Object.fromEntries(Object.entries(brief).filter(([, v]) => v)) };
    const buildItem = {
      quantity: 1,
      price_data: {
        currency: site.currency,
        unit_amount: plan.priceCents,
        product_data: { name: `${site.brand} ${plan.name}`, description: plan.receiptNote, metadata: { plan: planId } },
      },
    };
    const params = {
      mode: care ? 'subscription' : 'payment',
      line_items: [buildItem],
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      metadata,
      custom_text: { submit: { message: plan.receiptNote + (planId === 'website' ? ' Bought a demo? Enter the code from your demo email above.' : '') } },
      success_url: url + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: url + '/?checkout=cancelled#order',
    };
    if (care) {
      // $299 build charged today + care plan billed monthly starting today, until cancelled.
      params.line_items.push({
        quantity: 1,
        price_data: {
          currency: site.currency,
          unit_amount: site.care.priceCents,
          recurring: { interval: site.care.interval },
          product_data: { name: `${site.brand} ${site.care.name}`, description: site.care.receiptNote, metadata: { plan: 'care' } },
        },
      });
      params.subscription_data = { description: `${site.brand} care plan: ${brief.business}`, metadata };
      // Clear auto-renewal disclosure right above the pay button.
      params.custom_text.submit = { message: `Care plan: $${(site.care.priceCents / 100).toFixed(0)} is charged today and then every month until you cancel. Cancel anytime online at ${site.manageLink || ''} or by emailing ${site.contactEmail}. By paying you agree to our Terms of service at ${url}/terms.html.` };
    } else {
      params.customer_creation = 'always';
      params.payment_intent_data = { description: `${site.brand} ${plan.name}: ${brief.business}`, metadata };
      if (planId === 'demo') {
        // The $9 website credit code goes ONLY in the demo's post-purchase email (invoice footer), never on the site.
        const code = process.env.DEMO_CODE || 'DEMO9';
        params.invoice_creation = {
          enabled: true,
          invoice_data: {
            description: `Veryeo website demo for ${brief.business}`,
            footer: `Your $9 website credit: when you buy your full Veryeo website, enter code ${code} at checkout and $9 comes off. One use per customer.`,
            metadata,
          },
        };
      }
    }
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
