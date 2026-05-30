const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const OWNER_PHONE  = process.env.OWNER_PHONE;
const TWILIO_FROM  = process.env.TWILIO_FROM;
const SB_URL       = process.env.SUPABASE_URL;
const SB_KEY       = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { name, phone, email, address, items, total, paymentId, isCOD } = req.body;

    // ── Save order to Supabase ────────────────────────
    if (SB_URL && SB_KEY) {
      try {
        await fetch(`${SB_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            id: String(paymentId),
            name, phone, email, address,
            items: items,
            total: Number(total),
            payment: isCOD ? 'COD' : 'Online',
            status: 'confirmed',
            tracking: '',
            order_date: new Date().toLocaleDateString('en-IN')
          })
        });
      } catch(e) { console.warn('Supabase order save error:', e); }
    }

    // ── Customer Message ──────────────────────────────
    const customerLines = [
      'The Painters - Order Confirmed!',
      '',
      `Dear ${name},`,
      '',
      'Your order has been placed successfully!',
      '',
      'Order Details:',
      ...items.map(i => `  - ${i}`),
      '',
      `Total: Rs.${Number(total).toLocaleString('en-IN')}`,
      isCOD ? 'Payment: Cash on Delivery' : `Payment ID: ${paymentId}`,
      `Order Ref: ${String(paymentId).slice(-8).toUpperCase()}`,
      '',
      'We will contact you shortly to confirm delivery.',
      '',
      'Thank you for choosing The Painters!'
    ];

    // ── Owner Message ─────────────────────────────────
    const ownerLines = [
      isCOD ? '** New COD Order! **' : '** New Order Received! **',
      `Customer: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Items: ${items.join(', ')}`,
      `Total: Rs.${Number(total).toLocaleString('en-IN')}${isCOD?' (COD)':''}`,
      !isCOD ? `Payment ID: ${paymentId}` : '',
      `Address: ${address}`
    ].filter(Boolean);

    // ── Twilio ────────────────────────────────────────
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    async function sendMsg(to, lines) {
      const r = await fetch(twilioUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': auth },
        body: new URLSearchParams({ From: TWILIO_FROM, To: `whatsapp:${to}`, Body: lines.join('\n') }).toString()
      });
      return r.json();
    }

    const [custData, ownerData] = await Promise.all([
      sendMsg(`+91${phone}`, customerLines),
      sendMsg(OWNER_PHONE, ownerLines)
    ]);

    if (custData.sid && ownerData.sid) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: custData.message || ownerData.message });
    }

  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}