import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(url, key)

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function getReservations({ date, status } = {}) {
  let q = supabase
    .from('reservations')
    .select('*, table:tables(id,name,zone,capacity)')
    .order('date').order('time')
  if (date)   q = q.eq('date', date)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createReservation(payload) {
  const { data, error } = await supabase
    .from('reservations')
    .insert(payload)
    .select('*, table:tables(id,name,zone,capacity)')
    .single()
  if (error) throw error
  return data
}

export async function updateReservation(id, payload) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, table:tables(id,name,zone,capacity)')
    .single()
  if (error) throw error
  return data
}

export async function deleteReservation(id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id)
  if (error) throw error
}

export async function getReservationByToken(token) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, table:tables(id,name,zone,capacity)')
    .eq('cancel_token', token)
    .single()
  if (error) return null
  return data
}

export async function seatReservation(id) {
  return updateReservation(id, { status: 'seated', seated_at: new Date().toISOString() })
}

export async function earlyFreeReservation(id) {
  return updateReservation(id, { status: 'early_free', freed_at: new Date().toISOString() })
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function getTables() {
  const { data, error } = await supabase.from('tables').select('*').order('position')
  if (error) throw error
  return data
}

export async function createTable(payload) {
  const { data, error } = await supabase.from('tables').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTable(id, payload) {
  const { data, error } = await supabase.from('tables').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTable(id) {
  const { error } = await supabase.from('tables').delete().eq('id', id)
  if (error) throw error
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function getWaitlist() {
  const { data, error } = await supabase
    .from('waitlist').select('*').order('date').order('time').order('created_at')
  if (error) throw error
  return data
}

export async function addToWaitlist(payload) {
  const { data, error } = await supabase
    .from('waitlist').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateWaitlistEntry(id, payload) {
  const { data, error } = await supabase
    .from('waitlist').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteWaitlistEntry(id) {
  const { error } = await supabase.from('waitlist').delete().eq('id', id)
  if (error) throw error
}

export async function getWaitlistByToken(token) {
  const { data } = await supabase
    .from('waitlist').select('*').eq('confirm_token', token).single()
  return data
}

export async function getNextWaiting(date, time) {
  const { data } = await supabase
    .from('waitlist')
    .select('*')
    .eq('date', date)
    .eq('time', time)
    .eq('status', 'waiting')
    .order('created_at')
    .limit(1)
    .single()
  return data
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) throw error
  return Object.fromEntries(data.map(r => [r.key, r.value]))
}

export async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value: String(value) })
  if (error) throw error
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function getAvailableSlots(date) {
  const { data: reservations } = await supabase
    .from('reservations')
    .select('time, guests, table_id')
    .eq('date', date)
    .not('status', 'in', '("cancelled","early_free","completed","no_show")')

  const { data: tables } = await supabase
    .from('tables')
    .select('id, capacity')
    .eq('is_active', true)
    .eq('is_blocked', false)
    .eq('zone', 'interior')

  const totalTables   = (tables || []).length
  const totalCapacity = (tables || []).reduce((s, t) => s + t.capacity, 0)
  const BLOCK_H = 1.5

  const byTime = {}
  for (const r of reservations || []) {
    const [rh, rm] = r.time.split(':').map(Number)
    const resStart = rh + rm / 60
    const resEnd   = resStart + BLOCK_H
    const slots = ['11:30','12:00','12:30','13:00','13:30','14:00','14:30',
      '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
      '19:00','19:30','20:00','20:30','21:00','21:30']
    for (const slot of slots) {
      const [sh, sm] = slot.split(':').map(Number)
      const slotStart = sh + sm / 60
      const slotEnd   = slotStart + BLOCK_H
      if (slotStart < resEnd && slotEnd > resStart) {
        const key = slot + ':00'
        byTime[key] = (byTime[key] || 0) + 1
      }
    }
  }

  return { byTime, totalCapacity, totalTables }
}

export async function getOccupiedTablesForSlot(date, time) {
  const { data } = await supabase
    .from('reservations')
    .select('table_id, time')
    .eq('date', date)
    .not('status', 'in', '("cancelled","early_free","completed","no_show")')
    .not('table_id', 'is', null)

  const [sh, sm] = time.replace(':00','').split(':').map(Number)
  const slotStart = sh + sm / 60
  const slotEnd   = slotStart + 1.5

  return (data || [])
    .filter(r => {
      const [rh, rm] = r.time.split(':').map(Number)
      const resStart = rh + rm / 60
      const resEnd   = resStart + 1.5
      return slotStart < resEnd && slotEnd > resStart
    })
    .map(r => r.table_id)
}

// ─── Emails (via /api routes) ─────────────────────────────────────────────────

export async function sendEmail(type, data) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
    })
    return res.ok
  } catch { return false }
}

// ─── Table Groups ─────────────────────────────────────────────────────────────

export async function getTableGroups() {
  const { data, error } = await supabase
    .from('table_groups')
    .select('*')
    .order('position')
  if (error) throw error
  return data
}

export async function createTableGroup(payload) {
  const { data, error } = await supabase
    .from('table_groups').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTableGroup(id, payload) {
  const { data, error } = await supabase
    .from('table_groups').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTableGroup(id) {
  const { error } = await supabase.from('table_groups').delete().eq('id', id)
  if (error) throw error
}

export async function getOccupiedGroupsForSlot(date, time) {
  const { data } = await supabase
    .from('reservations')
    .select('group_id, time')
    .eq('date', date)
    .not('status', 'in', '("cancelled","early_free","completed","no_show")')
    .not('group_id', 'is', null)

  const [sh, sm] = time.replace(':00','').split(':').map(Number)
  const slotStart = sh + sm / 60
  const slotEnd   = slotStart + 1.5

  return (data || [])
    .filter(r => {
      const [rh, rm] = r.time.split(':').map(Number)
      const resStart = rh + rm / 60
      return slotStart < resStart + 1.5 && slotEnd > resStart
    })
    .map(r => r.group_id)
}

// ─── Breakfast Reservations ───────────────────────────────────────────────────

export async function getBreakfastReservations({ date, hotel } = {}) {
  let q = supabase
    .from('breakfast_reservations')
    .select('*')
    .order('date').order('created_at')
  if (date)  q = q.eq('date', date)
  if (hotel) q = q.eq('hotel', hotel)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createBreakfastReservation(payload) {
  const { data, error } = await supabase
    .from('breakfast_reservations')
    .insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateBreakfastReservation(id, payload) {
  const { data, error } = await supabase
    .from('breakfast_reservations')
    .update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteBreakfastReservation(id) {
  const { error } = await supabase
    .from('breakfast_reservations').delete().eq('id', id)
  if (error) throw error
}

export async function getBreakfastAvailability(date, maxGuests) {
  const { data } = await supabase
    .from('breakfast_reservations')
    .select('guests')
    .eq('date', date)
    .neq('status', 'cancelled')
  const used = (data||[]).reduce((s,r)=>s+r.guests, 0)
  return Math.max(0, maxGuests - used)
}
