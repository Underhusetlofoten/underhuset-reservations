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

  return res.status(200).json({ completed, noShowed })
}
