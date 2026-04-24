// Vercel Cron Job — runs every 15 minutes
// Marks seated reservations as completed if seated_at > 90 minutes ago

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // Allow both cron and manual calls
  const now = new Date()
  const cutoff = new Date(now.getTime() - 90 * 60 * 1000).toISOString()

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations?status=eq.seated&seated_at=lt.${cutoff}&select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  })
  const rows = await response.json()

  if (!rows.length) return res.status(200).json({ completed: 0 })

  const ids = rows.map(r => r.id)

  await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ status: 'completed' })
  })

  res.status(200).json({ completed: ids.length })
}
