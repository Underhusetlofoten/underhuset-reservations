import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date()
  const todayISO = now.toISOString().split('T')[0]

  // Auto-complete seated reservations after 90 minutes
  const { data: seated } = await supabase
    .from('reservations')
    .select('*')
    .eq('status', 'seated')
    .eq('date', todayISO)
    .not('seated_at', 'is', null)

  let completed = 0
  for (const r of (seated || [])) {
    const mins = (now - new Date(r.seated_at)) / 60000
    if (mins >= 90) {
      await supabase.from('reservations').update({ status: 'completed' }).eq('id', r.id)
      completed++
    }
  }

  // Auto no-show after 15 minutes
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const { data: pending } = await supabase
    .from('reservations')
    .select('*')
    .in('status', ['pending', 'confirmed'])
    .eq('date', todayISO)

  let noShowed = 0
  for (const r of (pending || [])) {
    const [h, m] = r.time.split(':').map(Number)
    const resMin = h * 60 + m
    if (nowMin - resMin >= 15) {
      await supabase.from('reservations').update({ status: 'no_show' }).eq('id', r.id)
      noShowed++
    }
  }

  // Expire waitlist notifications past confirmation window, notify next
  const { data: settingsRows } = await supabase.from('settings').select('*').eq('key', 'waitlist_confirm_minutes')
  const confirmMinutes = parseInt(settingsRows?.[0]?.value || '20')

  const { data: notifiedEntries } = await supabase
    .from('waitlist')
    .select('*')
    .eq('status', 'notified')

  let expired = 0
  let renotified = 0
  for (const entry of (notifiedEntries || [])) {
    if (!entry.notified_at) continue
    const mins = (now - new Date(entry.notified_at)) / 60000
    if (mins >= confirmMinutes) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
      expired++

      // Find next waiting entry for same date/time
      const { data: nextEntries } = await supabase
        .from('waitlist')
        .select('*')
        .eq('date', entry.date)
        .eq('time', entry.time)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1)

      const next = nextEntries?.[0]
      if (next) {
        await supabase.from('waitlist').update({ status: 'notified', notified_at: new Date().toISOString() }).eq('id', next.id)
        const resend = new Resend(process.env.RESEND_API_KEY)
        const confirmUrl = `https://reservas.underhusetlofoten.com/confirm-waitlist/${next.confirm_token}`
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'reservations@underhusetlofoten.com',
          to: next.email,
          subject: 'A table is available — Underhuset',
          html: `<p>Hi ${next.first_name},</p><p>A table just became available for your requested date and time. Please confirm within ${confirmMinutes} minutes to secure it:</p><p><a href="${confirmUrl}">Confirm my reservation</a></p>`
        })
        renotified++
      }
    }
  }

  return res.status(200).json({ completed, noShowed, expired, renotified })
}
