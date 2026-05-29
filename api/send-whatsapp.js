export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const TWILIO_SID   = process.env.TWILIO_SID;
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
  const OWNER_PHONE  = process.env.OWNER_PHONE;
  const TWILIO_FROM  = process.env.TWILIO_FROM;

  try {
    const { name, phone, email, address, items, total, paymentId, isCOD } = req.body;

    // ── Customer Message ──────────────────────────────
    const customerMsg = [
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
      'We will contact you shortly to confirm your delivery.',
      '',
      'Thank you for choosing The Painters!'
    ].join('\n');

    // ── Owner Message ─────────────────────────────────
    const ownerMsg = [
      isCOD ? '** New COD Order! **' : '** New Order Received! **',
      `Customer: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Items: ${items.join(', ')}`,
      `Total: Rs.${Number(total).toLocaleString('en-IN')}${isCOD ? ' (COD)' : ''}`,
      !isCOD ? `Payment ID: ${paymentId}` : '',
      `Address: ${address}`
    ].filter(Boolean).join('\n');

    // ── Twilio API ────────────────────────────────────
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    async function sendMsg(to, body) {
      const r = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: `whatsapp:${to}`,
          Body: body
        }).toString()
      });
      return r.json();
    }

    // Send to customer + owner in parallel
    const [custData, ownerData] = await Promise.all([
      sendMsg(`+91${phone}`, customerMsg),
      sendMsg(OWNER_PHONE, ownerMsg)
    ]);

    if (custData.sid && ownerData.sid) {
      return res.status(200).json({ success: true });
    } else {
      console.error('Twilio error:', custData, ownerData);
      return res.status(500).json({ 
        success: false, 
        error: custData.message || ownerData.message 
      });
    }

  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
