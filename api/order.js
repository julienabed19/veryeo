// GET /api/order?session_id=cs_...  -> order summary for the confirmation page
const { stripe } = require('../lib/stripe');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.session_id) || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Invalid order link.' });
  try {
    const s = await stripe('GET', '/checkout/sessions/' + id, { expand: ['line_items'] });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      paid: s.payment_status === 'paid',
      orderNumber: (s.payment_intent || s.invoice || s.id).toString().slice(-8).toUpperCase(),
      email: s.customer_details && s.customer_details.email,
      name: s.customer_details && s.customer_details.name,
      plan: s.metadata && s.metadata.plan,
      care: s.mode === 'subscription',
      business: s.metadata && s.metadata.business,
      currency: s.currency,
      discount: (s.total_details && s.total_details.amount_discount) || 0,
      total: s.amount_total,
      items: ((s.line_items && s.line_items.data) || []).map((l) => ({ name: l.description, qty: l.quantity, amount: l.amount_subtotal })),
    });
  } catch (e) {
    console.error(e);
    return res.status(404).json({ error: 'We could not find that order.' });
  }
};
