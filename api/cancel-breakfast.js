import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const { data: r, error } = await supabase
    .from('breakfast_reservations')
    .select('*')
    .eq('cancel_token', token)
    .single()

  if (error || !r) return res.status(404).send(notFoundPage())
  if (r.status === 'cancelled') return res.status(200).send(alreadyCancelledPage(r))

  // Check if cancellation is still allowed (must be before the day of reservation)
  const today = new Date().toISOString().split('T')[0]
  if (r.date <= today) {
    return res.status(200).send(tooLatePage(r))
  }

  // Cancel the reservation
  await supabase.from('breakfast_reservations').update({ status: 'cancelled' }).eq('id', r.id)

  return res.status(200).send(successPage(r))
}

function basePage(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Underhuset</title>
  <style>body{font-family:'Helvetica Neue',sans-serif;background:#FAF6F0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:20px;padding:40px;max-width:480px;width:90%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.08)}
  h1{color:#3C4242;font-size:24px;margin:0 0 12px}p{color:#8A8F8F;font-size:15px;line-height:1.6}
  .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:20px}
  a{color:#F99D54;font-weight:600}</style></head><body><div class="card">${content}</div></body></html>`
}

function successPage(r) {
  return basePage(`<div class="badge" style="background:#FEE2E2;color:#EF4444">Cancelled</div>
    <h1>Reservation cancelled</h1>
    <p>Your breakfast reservation for <strong>${r.date}</strong> at Underhuset has been cancelled.<br>We hope to see you another time!</p>
    <p><a href="https://reservas.underhusetlofoten.com/breakfast">Make a new reservation</a></p>`)
}

function tooLatePage(r) {
  return basePage(`<div class="badge" style="background:#FEF3C7;color:#F59E0B">Too late</div>
    <h1>Cancellation not possible</h1>
    <p>Cancellations must be made <strong>before the day of your reservation</strong>.<br>Your reservation for <strong>${r.date}</strong> can no longer be cancelled online.</p>
    <p>Please contact us directly if you need assistance.</p>`)
}

function alreadyCancelledPage(r) {
  return basePage(`<div class="badge" style="background:#F3F4F6;color:#6B7280">Already cancelled</div>
    <h1>Already cancelled</h1>
    <p>This reservation has already been cancelled.</p>`)
}

function notFoundPage() {
  return basePage(`<div class="badge" style="background:#FEE2E2;color:#EF4444">Not found</div>
    <h1>Reservation not found</h1>
    <p>This cancellation link is invalid or has expired.</p>`)
}
