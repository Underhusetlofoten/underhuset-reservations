// Vercel Serverless Function — POST /api/send-email
// Requires env vars: RESEND_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const APP_URL  = process.env.APP_URL  || 'http://localhost:5173'
const FROM     = process.env.RESEND_FROM || 'Restaurant Underhuset <reservations@underhusetlofoten.com>'
const API_KEY  = process.env.RESEND_API_KEY || ''

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return new Date(Number(y), Number(m)-1, Number(d))
    .toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
}
function fmtTime(t) { return t ? t.slice(0,5) : '' }

function baseEmail(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF6F0;margin:0;padding:0}
.wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:#3C4242;padding:28px 32px;text-align:center}
.header h1{color:#fff;font-size:22px;margin:0;font-weight:700;letter-spacing:-.3px}
.header p{color:rgba(255,255,255,.6);font-size:12px;margin:4px 0 0;letter-spacing:.08em;text-transform:uppercase}
.body{padding:32px}
.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E6E6;font-size:14px}
.detail-label{color:#8A8F8F}.detail-value{font-weight:600;color:#3C4242}
.btn{display:inline-block;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;margin:20px 0}
.btn-orange{background:#F99D54;color:#fff}
.btn-red{background:#E05252;color:#fff}
.btn-purple{background:#7C3AED;color:#fff}
.notice{background:#FEF4EB;border-radius:10px;padding:14px;font-size:13px;color:#3C4242;margin-top:16px}
.footer{background:#FAF6F0;padding:20px 32px;text-align:center;font-size:12px;color:#8A8F8F}
</style></head><body><div class="wrap">
<div class="header"><h1>🍽️ Restaurant Underhuset</h1><p>Sakrisøy 8, 8390 Reine, Lofoten</p></div>
<div class="body">${content}</div>
<div class="footer">Restaurant Underhuset · Sakrisøy 8 · 8390 Reine, Lofoten, Norway<br>
<a href="https://underhusetlofoten.com" style="color:#F99D54">underhusetlofoten.com</a></div>
</div></body></html>`
}

function confirmationEmail(r) {
  const cancelUrl = `${APP_URL}/cancel/${r.cancel_token}`
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">Reservation Confirmed ✓</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">We look forward to welcoming you at Underhuset!</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(r.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(r.time)}</span></div>
    <div class="detail-row"><span class="detail-label">👥 Guests</span><span class="detail-value">${r.guests} ${r.guests===1?'guest':'guests'}</span></div>
    <div class="detail-row"><span class="detail-label">👤 Name</span><span class="detail-value">${r.first_name} ${r.last_name}</span></div>
    ${r.notes ? `<div class="detail-row"><span class="detail-label">📝 Notes</span><span class="detail-value">${r.notes}</span></div>` : ''}
    <div class="notice">
      ⏱️ <strong>Please note:</strong> We have a <strong>15-minute grace period</strong>. If you have not arrived within 15 minutes of your booking time, your table may be released to other guests.<br><br>
      Need to cancel? You can do so up to 2 hours before your reservation using the link below.
    </div>
    <center><a href="${cancelUrl}" class="btn btn-red" style="margin-top:24px">Cancel reservation</a></center>
  `)
}

function cancellationEmail(r) {
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">Reservation Cancelled</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">Your reservation has been successfully cancelled.</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(r.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(r.time)}</span></div>
    <div class="detail-row"><span class="detail-label">👤 Name</span><span class="detail-value">${r.first_name} ${r.last_name}</span></div>
    <p style="color:#8A8F8F;font-size:14px;margin-top:20px">We hope to welcome you at Underhuset another time.</p>
    <center><a href="${APP_URL}" class="btn btn-orange">Make a new reservation</a></center>
  `)
}

function reminderEmail(r) {
  const cancelUrl = `${APP_URL}/cancel/${r.cancel_token}`
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">Reservation Reminder 🔔</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">This is a reminder for your upcoming reservation at Restaurant Underhuset.</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(r.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(r.time)}</span></div>
    <div class="detail-row"><span class="detail-label">👥 Guests</span><span class="detail-value">${r.guests} ${r.guests===1?'guest':'guests'}</span></div>
    <div class="notice">⏱️ Please arrive within <strong>15 minutes</strong> of your booking time.</div>
    <center><a href="${cancelUrl}" class="btn btn-red" style="margin-top:24px">Cancel reservation</a></center>
  `)
}

function waitlistConfirmationEmail(e) {
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">You're on the Waitlist ⏳</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">We've added you to the waitlist for the following time slot.</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(e.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(e.time)}</span></div>
    <div class="detail-row"><span class="detail-label">👤 Name</span><span class="detail-value">${e.first_name} ${e.last_name}</span></div>
    <div class="notice">📧 If a spot becomes available, you'll receive an email with a link to confirm your reservation. You'll have <strong>2 hours</strong> to confirm before the spot is offered to the next person.</div>
  `)
}

function waitlistSpotEmail(e) {
  const confirmUrl = `${APP_URL}/confirm-waitlist/${e.confirm_token}`
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">A Spot is Available! 🎉</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">Good news — a spot has opened up for your waitlisted time.</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(e.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(e.time)}</span></div>
    <div class="detail-row"><span class="detail-label">👤 Name</span><span class="detail-value">${e.first_name} ${e.last_name}</span></div>
    <div class="notice">⚠️ <strong>Act quickly!</strong> This link expires in 2 hours. If not confirmed, the spot will be offered to the next person.</div>
    <center><a href="${confirmUrl}" class="btn btn-orange" style="margin-top:24px">✓ Confirm my reservation</a></center>
  `)
}

function noShowEmail(r) {
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">Reservation Not Honoured</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">We're sorry we couldn't accommodate you today.</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(r.date)}</span></div>
    <div class="detail-row"><span class="detail-label">⏰ Time</span><span class="detail-value">${fmtTime(r.time)}</span></div>
    <p style="color:#8A8F8F;font-size:14px;margin-top:20px">Your reservation has been marked as no-show as we did not receive you within 15 minutes of your booking time. We hope to see you next time!</p>
    <center><a href="${APP_URL}" class="btn btn-orange">Make a new reservation</a></center>
  `)
}

function breakfastConfirmationEmail(r) {
  return baseEmail(`
    <h2 style="color:#3C4242;margin:0 0 8px">Breakfast Reservation Confirmed ✓</h2>
    <p style="color:#8A8F8F;margin:0 0 24px;font-size:14px">We look forward to welcoming you for breakfast at Underhuset!</p>
    <div class="detail-row"><span class="detail-label">📅 Date</span><span class="detail-value">${fmtDate(r.date)}</span></div>
    <div class="detail-row"><span class="detail-label">🕗 Breakfast time</span><span class="detail-value">${r.from || '08:00'} – ${r.to || '11:00'}</span></div>
    <div class="detail-row"><span class="detail-label">👥 Guests</span><span class="detail-value">${r.guests} ${r.guests===1?'guest':'guests'}</span></div>
    <div class="detail-row"><span class="detail-label">👤 Name</span><span class="detail-value">${r.first_name}</span></div>
    ${r.hotel ? `<div class="detail-row"><span class="detail-label">🏨 Property</span><span class="detail-value">${r.hotel}</span></div>` : ''}
    ${r.notes ? `<div class="detail-row"><span class="detail-label">📝 Notes</span><span class="detail-value">${r.notes}</span></div>` : ''}
    <div class="notice">
      We look forward to seeing you! If you need to cancel, please let us know as soon as possible.
    </div>
  `)
}

async function sendResend(to, subject, html) {
  if (!API_KEY) return { ok: false, error: 'No API key' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  return { ok: res.ok, status: res.status }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, reservation, entry } = req.body

  try {
    let result
    if (type === 'confirmation') {
      result = await sendResend(reservation.email,
        'Reservation confirmed — Restaurant Underhuset',
        confirmationEmail(reservation))
    } else if (type === 'cancellation') {
      result = await sendResend(reservation.email,
        'Reservation cancelled — Restaurant Underhuset',
        cancellationEmail(reservation))
    } else if (type === 'reminder') {
      result = await sendResend(reservation.email,
        'Reminder: Your reservation at Restaurant Underhuset',
        reminderEmail(reservation))
    } else if (type === 'waitlist_confirmation') {
      result = await sendResend(entry.email,
        "You're on the waitlist — Restaurant Underhuset",
        waitlistConfirmationEmail(entry))
    } else if (type === 'waitlist_spot') {
      result = await sendResend(entry.email,
        'A spot is available! — Restaurant Underhuset',
        waitlistSpotEmail(entry))
    } else if (type === 'breakfast_confirmation') {
      result = await sendResend(reservation.email,
        'Breakfast reservation confirmed — Restaurant Underhuset',
        breakfastConfirmationEmail(reservation))
    } else if (type === 'no_show') {
      result = await sendResend(reservation.email,
        'Reservation no-show — Restaurant Underhuset',
        noShowEmail(reservation))
    } else {
      return res.status(400).json({ error: 'Unknown email type' })
    }
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
