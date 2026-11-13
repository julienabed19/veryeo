// Small in-memory rate limiter. Per serverless instance only, so also add a Vercel Firewall rate-limit rule.
const hits = new Map();

function limit(req, res, name, max, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = name + ':' + ip;
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    return false;
  }
  rec.n += 1;
  if (rec.n > max) {
    res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    return true;
  }
  return false;
}

module.exports = { limit };
