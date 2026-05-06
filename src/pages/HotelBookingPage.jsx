import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { B, MONTHS_EN, DAYS_SHORT } from '../brand.js'
import { supabase, getSettings } from '../lib/supabase.js'

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(d) {
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

async function getBreakfastAvailability(date, maxGuests) {
  const { data } = await supabase
    .from('breakfast_reservations')
    .select('guests')
    .eq('date', date)
    .neq('status', 'cancelled')
  const used = (data||[]).reduce((s,r)=>s+r.guests, 0)
  return Math.max(0, maxGuests - used)
}

async function createBreakfastReservation(payload) {
  const { data, error } = await supabase
    .from('breakfast_reservations')
    .insert(payload).select().single()
  if (error) throw error
  return data
}

function Btn({ children, onClick, disabled, variant='primary', style={} }) {
  const colors = {
    primary: { bg: disabled?B.grayLight:B.orange, color: disabled?B.gray:'#fff' },
    secondary: { bg:'#fff', color:B.dark, border:`2px solid ${B.grayLight}` },
  }
  const c = colors[variant]
  return (
    <button disabled={disabled} onClick={disabled?undefined:onClick} style={{
      border: c.border||'none', borderRadius:12, fontSize:15, fontWeight:700,
      cursor:disabled?'not-allowed':'pointer', padding:'14px 20px',
      background:c.bg, color:c.color, transition:'all .18s', ...style,
    }}
      onMouseEnter={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orangeDark }}
      onMouseLeave={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orange }}>
      {children}
    </button>
  )
}

function CalendarStep({ selected, onSelect, breakfastDays={}, closedPeriods=[] }) {
  const today = new Date()
  const [y, setY] = useState(today.getFullYear())
  const [m, setM] = useState(today.getMonth())
  const days  = new Date(y,m+1,0).getDate()
  const first = (new Date(y,m,1).getDay()+6)%7
  const isPast = day => { const d=new Date(y,m,day);d.setHours(0,0,0,0);const t=new Date();t.setHours(0,0,0,0);return d<t }
  const isSel  = day => selected&&selected.getFullYear()===y&&selected.getMonth()===m&&selected.getDate()===day
  const isTod  = day => today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===day
  const dayKeys = ['mon','tue','wed','thu','fri','sat','sun']
  const isBlocked = day => {
    const d = new Date(y,m,day)
    const dow = (d.getDay()+6)%7
    const key = dayKeys[dow]
    if (breakfastDays[key] === false) return true
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return closedPeriods.some(p => iso >= p.from && iso <= p.to)
  }

  return (
    <div style={{ background:'#fff', borderRadius:16, padding:24, boxShadow:`0 2px 20px rgba(60,66,66,.08)` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>m===0?(setY(y-1),setM(11)):setM(m-1)}
          style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:B.dark,padding:'2px 10px',borderRadius:8 }}
          onMouseEnter={e=>e.currentTarget.style.background=B.orangeLight}
          onMouseLeave={e=>e.currentTarget.style.background='none'}>‹</button>
        <span style={{ fontFamily:'Playfair Display,serif', fontSize:17, fontWeight:600, color:B.dark }}>{MONTHS_EN[m]} {y}</span>
        <button onClick={()=>m===11?(setY(y+1),setM(0)):setM(m+1)}
          style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:B.dark,padding:'2px 10px',borderRadius:8 }}
          onMouseEnter={e=>e.currentTarget.style.background=B.orangeLight}
          onMouseLeave={e=>e.currentTarget.style.background='none'}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
        {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:'center',fontSize:10,fontWeight:700,color:B.gray,letterSpacing:'.07em',textTransform:'uppercase' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {Array(first).fill(null).map((_,i)=><div key={'e'+i}/>)}
        {Array(days).fill(null).map((_,i)=>{
          const day=i+1, past=isPast(day), blocked=isBlocked(day), sel=isSel(day), tod=isTod(day)
          const disabled = past||blocked
          return (
            <button key={day} disabled={disabled} onClick={()=>onSelect(new Date(y,m,day))} style={{
              aspectRatio:'1', border:'none', borderRadius:9,
              background:sel?B.orange:tod?B.orangeLight:'transparent',
              color:sel?'#fff':disabled?B.grayLight:B.dark,
              fontSize:14, fontWeight:sel||tod?700:400, cursor:disabled?'not-allowed':'pointer',
              outline:tod&&!sel?`2px solid ${B.orange}`:'none',
            }}
              onMouseEnter={e=>{ if(!disabled&&!sel) e.currentTarget.style.background=B.orangeLight }}
              onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background=tod?B.orangeLight:'transparent' }}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function HotelBookingPage() {
  const { partner } = useParams() // 'ingrid' | 'marta' | undefined
  const [step,     setStep]     = useState(0)
  const [date,     setDate]     = useState(null)
  const [avail,    setAvail]    = useState(null)
  const [settings, setSettings] = useState({})
  const [hotels,   setHotels]   = useState([])
  const [form,     setForm]     = useState({ hotel:'', guests:1, contact_name:'', contact_email:'', contact_phone:'', notes:'' })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const upd = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s)
      try {
        const all = JSON.parse(s.hotels||'[]')
        // Filter by partner if URL has /hotel/ingrid or /hotel/marta
        if (partner === 'ingrid') {
          const ingridHotels = JSON.parse(s.hotels_ingrid||'[]')
          setHotels(ingridHotels.length > 0 ? ingridHotels : all)
        } else if (partner === 'marta') {
          const martaHotels = JSON.parse(s.hotels_marta||'[]')
          setHotels(martaHotels.length > 0 ? martaHotels : all)
        } else {
          setHotels(all)
        }
      } catch { setHotels([]) }
    })
  }, [partner])

  useEffect(() => {
    if (!date || !settings.breakfast_max_guests) return
    getBreakfastAvailability(toISO(date), parseInt(settings.breakfast_max_guests||44))
      .then(setAvail)
  }, [date, settings])

  let breakfastDays = {}
  let breakfastClosedPeriods = []
  try { breakfastDays = JSON.parse(settings.breakfast_days||'{}') } catch {}
  try { breakfastClosedPeriods = JSON.parse(settings.breakfast_closed_periods||'[]') } catch {}

  const maxGuests = parseInt(settings.breakfast_max_guests||44)
  const from = settings.breakfast_from || '08:00'
  const to   = settings.breakfast_to   || '11:00'

  // Partner display name
  const partnerName = partner === 'ingrid' ? "Ingrid's properties"
    : partner === 'marta' ? "Marta's properties"
    : null

  const canNext = () => {
    if (step===0) return !!date && avail > 0
    if (step===1) return form.hotel && form.guests >= 1 && form.contact_name && form.contact_email
    return true
  }

  const confirm = async () => {
    setLoading(true); setError(null)
    try {
      await createBreakfastReservation({
        date: toISO(date), guests: parseInt(form.guests),
        hotel: form.hotel, contact_name: form.contact_name,
        contact_email: form.contact_email, contact_phone: form.contact_phone,
        notes: form.notes, status: 'confirmed',
      })
      setStep(3)
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const labelStyle = { display:'block', fontSize:11, fontWeight:700, color:B.dark, marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase' }
  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:`2px solid ${B.grayLight}`, fontSize:14, color:B.dark, outline:'none', transition:'border .2s', background:'#fff' }

  return (
    <div style={{
      minHeight:'100vh', position:'relative',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'24px 16px 60px',
      fontFamily:"'DM Sans','Helvetica Neue',sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;700&display=swap');`}</style>
      {/* Background photo */}
      <div style={{ position:'fixed', inset:0, zIndex:0, backgroundImage:'url(/restaurant.jpg)', backgroundSize:'cover', backgroundPosition:'center', filter:'brightness(0.35)' }}/>
      {/* Content */}
      <div style={{ position:'relative', zIndex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src="/logo.png" alt="Underhuset" style={{ height:110, objectFit:'contain', display:'block', margin:'0 auto' }}/>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', letterSpacing:'.1em', textTransform:'uppercase', marginTop:8 }}>Breakfast Buffet · Reservations</div>
          {partnerName && (
            <div style={{ marginTop:6, fontSize:12, color:'#fff', fontWeight:600, background:'rgba(255,255,255,.15)', padding:'4px 14px', borderRadius:20, display:'inline-block' }}>
              {partnerName}
            </div>
          )}
        </div>
        <div style={{ width:'100%', maxWidth:500, background:'rgba(255,255,255,0.97)', borderRadius:24, padding:'28px 24px', boxShadow:'0 8px 48px rgba(0,0,0,.3)' }}>

        {/* Info bar */}
        <div style={{ background:B.blueLight, borderRadius:12, padding:'10px 16px', marginBottom:24, display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:B.blue, fontWeight:600 }}>🕗 {from} – {to}</span>
          <span style={{ fontSize:13, color:B.blue, fontWeight:600 }}>👥 Max {maxGuests} guests/day</span>
        </div>

        {step === 3 ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:24, color:B.dark, marginBottom:8 }}>Reservation confirmed!</h2>
            <p style={{ color:B.gray, fontSize:14, lineHeight:1.7, marginBottom:24 }}>
              Breakfast for <strong>{form.guests} guests</strong> from <strong>{form.hotel}</strong><br/>
              on <strong style={{ color:B.orange }}>{fmtDate(date)}</strong>
            </p>
            <p style={{ fontSize:12, color:B.gray }}>Confirmation sent to <strong>{form.contact_email}</strong></p>
          </div>
        ) : (
          <>
            {/* Step 0: Date */}
            {step === 0 && (
              <div>
                <h2 style={{ textAlign:'center', fontSize:20, fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:6, fontWeight:600 }}>Select date</h2>
                <p style={{ textAlign:'center', color:B.gray, fontSize:13, marginBottom:20 }}>Choose the breakfast date</p>
                <CalendarStep selected={date} onSelect={d=>{ setDate(d); setAvail(null) }} breakfastDays={breakfastDays} closedPeriods={breakfastClosedPeriods} />
                {date && avail !== null && (
                  <div style={{ marginTop:16, padding:12, borderRadius:10,
                    background:avail>0?B.greenLight:B.redLight,
                    color:avail>0?B.green:B.red, fontSize:13, fontWeight:600, textAlign:'center' }}>
                    {avail > 0
                      ? `✓ ${avail} spots available`
                      : `✗ Fully booked on this date`}
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Details */}
            {step === 1 && (
              <div>
                <h2 style={{ textAlign:'center', fontSize:20, fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:6, fontWeight:600 }}>Reservation details</h2>
                <p style={{ textAlign:'center', color:B.gray, fontSize:13, marginBottom:20, textTransform:'capitalize' }}>{fmtDate(date)}</p>
                <div style={{ display:'grid', gap:16 }}>
                  <div>
                    <label style={labelStyle}>Property *</label>
                    <select value={form.hotel} onChange={e=>upd('hotel',e.target.value)}
                      style={{...inputStyle, cursor:'pointer', appearance:'auto'}}
                      onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}>
                      <option value="">Select property…</option>
                      {hotels.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Number of guests *</label>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <button onClick={()=>upd('guests',Math.max(1,form.guests-1))}
                        style={{ width:40,height:40,borderRadius:10,border:`2px solid ${B.grayLight}`,background:'#fff',fontSize:20,cursor:'pointer',fontWeight:700,flexShrink:0 }}>−</button>
                      <span style={{ fontSize:24,fontWeight:700,color:B.dark,minWidth:40,textAlign:'center' }}>{form.guests}</span>
                      <button onClick={()=>upd('guests',Math.min(avail||maxGuests,form.guests+1))}
                        style={{ width:40,height:40,borderRadius:10,border:`2px solid ${B.grayLight}`,background:'#fff',fontSize:20,cursor:'pointer',fontWeight:700,flexShrink:0 }}>+</button>
                      <span style={{ fontSize:13,color:B.gray }}>{avail} spots left</span>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Your name *</label>
                    <input value={form.contact_name} onChange={e=>upd('contact_name',e.target.value)} placeholder="Contact name"
                      style={inputStyle} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" value={form.contact_email} onChange={e=>upd('contact_email',e.target.value)} placeholder="email@property.com"
                      style={inputStyle} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Phone (optional)</label>
                    <input type="tel" value={form.contact_phone} onChange={e=>upd('contact_phone',e.target.value)} placeholder="+47 000 00 000"
                      style={inputStyle} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Notes (optional)</label>
                    <textarea value={form.notes} onChange={e=>upd('notes',e.target.value)} rows={2}
                      placeholder="Allergies, special requests…"
                      style={{...inputStyle, resize:'vertical'}}
                      onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Confirm */}
            {step === 2 && (
              <div>
                <h2 style={{ textAlign:'center', fontSize:20, fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:6, fontWeight:600 }}>Confirm reservation</h2>
                <p style={{ textAlign:'center', color:B.gray, fontSize:13, marginBottom:20 }}>Please review before confirming</p>
                <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
                  {[
                    ['📅 Date',     fmtDate(date)],
                    ['🕗 Time',     `${from} – ${to}`],
                    ['🏨 Property', form.hotel],
                    ['👥 Guests',   `${form.guests} guests`],
                    ['👤 Contact',  form.contact_name],
                    ['📧 Email',    form.contact_email],
                    ...(form.contact_phone?[['📱 Phone',form.contact_phone]]:[]),
                    ...(form.notes?[['📝 Notes',form.notes]]:[]),
                  ].map(([label,value])=>(
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${B.grayLight}`, fontSize:13 }}>
                      <span style={{ color:B.gray }}>{label}</span>
                      <span style={{ fontWeight:600, color:B.dark, textAlign:'right', maxWidth:'60%' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {error && <p style={{ color:B.red, fontSize:13, textAlign:'center', marginTop:12 }}>{error}</p>}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display:'flex', gap:12, marginTop:24 }}>
              {step > 0 && <Btn variant="secondary" onClick={()=>setStep(s=>s-1)} style={{ flex:1 }}>← Back</Btn>}
              {step < 2 && <Btn onClick={()=>setStep(s=>s+1)} disabled={!canNext()} style={{ flex:2 }}>Continue →</Btn>}
              {step === 2 && <Btn onClick={confirm} disabled={loading} style={{ flex:2 }}>{loading?'Booking…':'✓ Confirm'}</Btn>}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
