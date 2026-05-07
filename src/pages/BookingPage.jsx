import { useState, useEffect } from 'react'
import { B, MONTHS_EN, DAYS_SHORT, ALL_TIMES, BLOCK_HOURS } from '../brand.js'
import { createReservation, getAvailableSlots, addToWaitlist, getSettings, sendEmail } from '../lib/supabase.js'

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(d) {
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
}
function timeToH(t) {
  const [h,m] = t.split(':').map(Number); return h + m/60
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Btn({ children, onClick, disabled, variant='primary', style={} }) {
  const base = { border:'none', borderRadius:12, fontSize:15, fontWeight:700,
    cursor:disabled?'not-allowed':'pointer', padding:'14px 20px', transition:'all .18s', ...style }
  const v = {
    primary:   { background:disabled?B.grayLight:B.orange, color:disabled?B.gray:'#fff' },
    secondary: { background:'#fff', color:B.dark, border:`2px solid ${B.grayLight}` },
    waitlist:  { background:B.purpleLight, color:B.purple, border:`2px solid ${B.purple}` },
  }
  return (
    <button style={{...base,...v[variant]}} onClick={disabled?undefined:onClick}
      onMouseEnter={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orangeDark }}
      onMouseLeave={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orange }}>
      {children}
    </button>
  )
}

function Steps({ step, isWaitlist }) {
  const labels = isWaitlist
    ? ['Date','Time','Details','Confirm']
    : ['Date','Time','Guests','Details','Confirm']
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32 }}>
      {labels.map((l,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
            <div style={{
              width:30, height:30, borderRadius:'50%',
              background:i<step?B.orange:i===step?B.orange:'transparent',
              border:`2px solid ${i<=step?B.orange:B.grayLight}`,
              color:i<=step?'#fff':B.gray, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:12, fontWeight:700,
            }}>
              {i<step?'✓':i+1}
            </div>
            <span style={{ fontSize:9, letterSpacing:'.06em', textTransform:'uppercase',
              color:i===step?B.orange:B.gray, fontWeight:i===step?700:400 }}>{l}</span>
          </div>
          {i<labels.length-1 && (
            <div style={{ width:28, height:2, margin:'0 2px', marginBottom:22,
              background:i<step?B.orange:B.grayLight }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 0: Calendar ─────────────────────────────────────────────────────────

function CalendarStep({ selected, onSelect, openingHours, closedPeriods=[] }) {
  const today = new Date()
  const [y, setY] = useState(today.getFullYear())
  const [m, setM] = useState(today.getMonth())

  const days = new Date(y,m+1,0).getDate()
  const first = (new Date(y,m,1).getDay()+6)%7
  const dayKeys = ['mon','tue','wed','thu','fri','sat','sun']

  const isClosed = (day) => {
    const d = new Date(y, m, day)
    const dow = (d.getDay() + 6) % 7
    const key = dayKeys[dow]
    if (openingHours && openingHours[key] && !openingHours[key].open) return true
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return closedPeriods.some(p => iso >= p.from && iso <= p.to)
  }
  const isPast = (day) => {
    const d = new Date(y,m,day); d.setHours(0,0,0,0)
    const t = new Date(); t.setHours(0,0,0,0)
    return d < t
  }
  const isSel = (day) => selected&&selected.getFullYear()===y&&selected.getMonth()===m&&selected.getDate()===day
  const isTod = (day) => today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===day

  return (
    <div>
      <h2 style={titleStyle}>When would you like to visit?</h2>
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <NavBtn onClick={()=>m===0?(setY(y-1),setM(11)):setM(m-1)}>‹</NavBtn>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:17, fontWeight:600, color:B.dark }}>
            {MONTHS_EN[m]} {y}
          </span>
          <NavBtn onClick={()=>m===11?(setY(y+1),setM(0)):setM(m+1)}>›</NavBtn>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
          {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:B.gray, letterSpacing:'.07em', textTransform:'uppercase' }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
          {Array(first).fill(null).map((_,i)=><div key={'e'+i}/>)}
          {Array(days).fill(null).map((_,i)=>{
            const day=i+1, past=isPast(day), closed=isClosed(day), sel=isSel(day), tod=isTod(day)
            const blocked = past||closed
            return (
              <button key={day} disabled={blocked} onClick={()=>onSelect(new Date(y,m,day))} style={{
                aspectRatio:'1', border:'none', borderRadius:9,
                background:sel?B.orange:tod?B.orangeLight:'transparent',
                color:sel?'#fff':blocked?B.grayLight:B.dark,
                fontSize:14, fontWeight:sel||tod?700:400,
                cursor:blocked?'not-allowed':'pointer', transition:'all .15s',
                outline:tod&&!sel?`2px solid ${B.orange}`:'none',
                textDecoration: closed&&!past ? 'line-through' : 'none',
              }}
                onMouseEnter={e=>{ if(!blocked&&!sel) e.currentTarget.style.background=B.orangeLight }}
                onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background=tod?B.orangeLight:'transparent' }}>
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:B.dark, padding:'2px 10px', borderRadius:8 }}
      onMouseEnter={e=>e.currentTarget.style.background=B.orangeLight}
      onMouseLeave={e=>e.currentTarget.style.background='none'}>
      {children}
    </button>
  )
}

// ─── Step 1: Time ─────────────────────────────────────────────────────────────

function TimeStep({ selected, onSelect, onJoinWaitlist, date, openingHours, lunchEnabled=true, dinnerEnabled=true }) {
  const [availability, setAvailability] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    getAvailableSlots(toISO(date)).then(a => { setAvailability(a); setLoading(false) })
  }, [date])

  const dayKeys = ['mon','tue','wed','thu','fri','sat','sun']
  const dow     = date ? (date.getDay()+6)%7 : 0
  const dayKey  = dayKeys[dow]
  const hours   = openingHours?.[dayKey] || {}

  // Filter times by opening hours
  const getVisibleTimes = () => {
    if (!hours.open) return []
    const lunchOn  = hours.lunch_enabled  !== false
    const dinnerOn = hours.dinner_enabled !== false
    return ALL_TIMES.filter(t => {
      const h = timeToH(t)
      const inLunch  = lunchOn  && hours.lunch_from  && hours.lunch_to  && h >= timeToH(hours.lunch_from)  && h + BLOCK_HOURS <= timeToH(hours.lunch_to)  + 0.01
      const inDinner = dinnerOn && hours.dinner_from && hours.dinner_to && h >= timeToH(hours.dinner_from) && h + BLOCK_HOURS <= timeToH(hours.dinner_to) + 0.01
      return inLunch || inDinner
    })
  }

  const visibleTimes = getVisibleTimes()
  const lunchTimes  = lunchEnabled  ? visibleTimes.filter(t => timeToH(t) < 16) : []
  const dinnerTimes = dinnerEnabled ? visibleTimes.filter(t => timeToH(t) >= 16) : []

  const isFull = (time) => {
    const key  = time + ':00'
    const used = availability.byTime?.[key] || 0
    return used >= (availability.totalTables || 999)
  }

  const isTooSoon = (time) => {
    if (!date) return false
    const today = new Date()
    if (date.toDateString() !== today.toDateString()) return false
    const [h,m] = time.split(':').map(Number)
    const slotMin = h*60+m
    const nowMin  = today.getHours()*60+today.getMinutes()
    return slotMin - nowMin < 15
  }

  const TimeBtn = ({ time }) => {
    const full    = isFull(time)
    const soon    = isTooSoon(time)
    const unavail = soon
    const sel     = selected === time

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <button disabled={unavail} onClick={()=>!full&&onSelect(time)} style={{
          padding:'11px', borderRadius:12, fontSize:14, fontWeight:sel?700:500,
          border:`2px solid ${sel?B.orange:full?B.purpleLight:unavail?B.grayLight:B.grayLight}`,
          background:sel?B.orange:full?B.purpleLight:unavail?'#f5f5f5':'#fff',
          color:sel?'#fff':full?B.purple:unavail?B.grayLight:B.dark,
          cursor:unavail?'not-allowed':'pointer', transition:'all .15s',
        }}
          onMouseEnter={e=>{ if(!unavail&&!sel&&!full){e.currentTarget.style.borderColor=B.orange;e.currentTarget.style.background=B.orangeLight} }}
          onMouseLeave={e=>{ if(!sel&&!full){e.currentTarget.style.borderColor=B.grayLight;e.currentTarget.style.background=unavail?'#f5f5f5':'#fff'} }}>
          {time}
          {soon && <span style={{ display:'block', fontSize:9, color:B.gray, marginTop:1 }}>Too soon</span>}
          {full && !soon && <span style={{ display:'block', fontSize:9, color:B.purple, marginTop:1 }}>Full</span>}
        </button>
        {full && !soon && (
          <button onClick={()=>onJoinWaitlist(time)} style={{
            padding:'4px 8px', borderRadius:8, fontSize:10, fontWeight:700,
            border:`1px solid ${B.purple}`, background:B.purpleLight, color:B.purple, cursor:'pointer',
          }}>
            + Waitlist
          </button>
        )}
      </div>
    )
  }

  const fmt = date ? fmtDate(date) : ''

  return (
    <div>
      <h2 style={titleStyle}>Choose a time</h2>
      <p style={subStyle}>{fmt.charAt(0).toUpperCase()+fmt.slice(1)}</p>
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:B.gray }}>Checking availability…</div>
      ) : visibleTimes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign:'center', padding:40, color:B.gray }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🚫</div>
          <p>We are closed on this day.</p>
        </div>
      ) : (
        <div style={cardStyle}>
          {lunchTimes.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <SectionLabel>☀️ Lunch</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {lunchTimes.map(t=><TimeBtn key={t} time={t}/>)}
              </div>
            </div>
          )}
          {dinnerTimes.length > 0 && (
            <div style={{ borderTop: lunchTimes.length>0?`1px solid ${B.grayLight}`:'none', paddingTop:lunchTimes.length>0?24:0 }}>
              <SectionLabel>🌙 Dinner</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {dinnerTimes.map(t=><TimeBtn key={t} time={t}/>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Guests ───────────────────────────────────────────────────────────

function GuestsStep({ guests, onSelect, min=1, max=4 }) {
  return (
    <div>
      <h2 style={titleStyle}>How many guests?</h2>
      <p style={subStyle}>Maximum 4 guests online.</p>
      <div style={cardStyle}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {Array.from({length: max - min + 1}, (_,i) => i + min).map(n=>(
            <button key={n} onClick={()=>onSelect(n)} style={{
              aspectRatio:'1', borderRadius:14,
              border:`2px solid ${guests===n?B.orange:B.grayLight}`,
              background:guests===n?B.orange:'#fff', color:guests===n?'#fff':B.dark,
              fontSize:24, fontWeight:700, cursor:'pointer', transition:'all .15s',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
            }}
              onMouseEnter={e=>{ if(guests!==n){e.currentTarget.style.borderColor=B.orange;e.currentTarget.style.background=B.orangeLight} }}
              onMouseLeave={e=>{ if(guests!==n){e.currentTarget.style.borderColor=B.grayLight;e.currentTarget.style.background='#fff'} }}>
              <span style={{ fontSize:18 }}>{'👤'.repeat(n)}</span>
              <span style={{ fontSize:14 }}>{n}</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop:16, fontSize:13, color:B.darkSoft, textAlign:'center' }}>
          📞 For groups larger than 4, call us at <strong>+47 453 56 729</strong> or email <strong>you@underhusetlofoten.com</strong>
        </p>
      </div>
    </div>
  )
}

// ─── Step 3: Details ─────────────────────────────────────────────────────────

function DetailsStep({ form, onChange, isWaitlist }) {
  return (
    <div>
      <h2 style={titleStyle}>Your details</h2>
      <p style={subStyle}>
        {isWaitlist ? "We'll notify you by email if a spot opens up" : "We'll send your confirmation by email"}
      </p>
      <div style={cardStyle}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="First name *" value={form.first_name} onChange={v=>onChange('first_name',v)} placeholder="Anna" />
          <Field label="Last name *"  value={form.last_name}  onChange={v=>onChange('last_name',v)}  placeholder="Smith" />
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Email *" type="email" value={form.email} onChange={v=>onChange('email',v)} placeholder="anna@email.com" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Phone *" type="tel" value={form.phone} onChange={v=>onChange('phone',v)} placeholder="+47 000 00 000" />
          </div>
          {!isWaitlist && (
            <div style={{ gridColumn:'1/-1' }}>
              <label style={labelStyle}>Allergies or special requests (optional)</label>
              <textarea value={form.notes} onChange={e=>onChange('notes',e.target.value)}
                placeholder="Allergies, celebrations, special requests…" rows={3}
                style={{...inputStyle, resize:'vertical'}}
                onFocus={e=>e.target.style.borderColor=B.orange}
                onBlur={e=>e.target.style.borderColor=B.grayLight} />
            </div>
          )}
        </div>
        {!isWaitlist && (
          <div style={{ marginTop:16, display:'flex', gap:10, alignItems:'flex-start' }}>
            <input type="checkbox" id="terms" checked={form.terms} onChange={e=>onChange('terms',e.target.checked)}
              style={{ marginTop:3, accentColor:B.orange, width:16, height:16, cursor:'pointer', flexShrink:0 }} />
            <label htmlFor="terms" style={{ fontSize:12, color:B.gray, lineHeight:1.6, cursor:'pointer' }}>
              I accept the <span style={{ color:B.orange, fontWeight:600 }}>terms and conditions</span>:
              Reservations are held for <strong>15 minutes</strong> — if you have not arrived by then, your table may be released.
              You can cancel at any time using the link in your confirmation email.
              For groups of 3 or more, please cancel at least <strong>24 hours</strong> in advance.
              Maximum 4 guests per online reservation — for larger groups, <a href="https://underhusetlofoten.com/contact/" target="_blank" rel="noopener noreferrer" style={{ color:B.orange, fontWeight:600 }}>contact us directly</a>.
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type='text', placeholder='' }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
        onFocus={e=>e.target.style.borderColor=B.orange}
        onBlur={e=>e.target.style.borderColor=B.grayLight} />
    </div>
  )
}

// ─── Step 4: Summary ─────────────────────────────────────────────────────────

function SummaryStep({ date, time, guests, form, isWaitlist }) {
  const rows = [
    ['📅 Date',    fmtDate(date)],
    ['⏰ Time',    time],
    ['👥 Guests',  `${guests} ${guests===1?'guest':'guests'}`],
    ['👤 Name',    `${form.first_name} ${form.last_name}`],
    ['📧 Email',   form.email],
    ['📱 Phone',   form.phone],
    ...(form.notes ? [['📝 Notes', form.notes]] : []),
  ]
  return (
    <div>
      <h2 style={titleStyle}>{isWaitlist ? 'Join the waitlist' : 'Confirm reservation'}</h2>
      <p style={subStyle}>Please review your details</p>
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:16, marginBottom:4, borderBottom:`1px solid ${B.grayLight}` }}>
          <div style={{ width:42,height:42,borderRadius:12,background:B.orangeLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>🍽️</div>
          <div>
            <div style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:17, color:B.dark }}>Restaurant Underhuset</div>
            <div style={{ fontSize:12, color:B.gray }}>Sakrisøy 8, 8390 Reine, Lofoten</div>
          </div>
        </div>
        {rows.map(([label,value])=>(
          <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${B.grayLight}`, alignItems:'flex-start', gap:12 }}>
            <span style={{ fontSize:13, color:B.gray, flexShrink:0 }}>{label}</span>
            <span style={{ fontSize:13, fontWeight:600, color:B.dark, textAlign:'right', textTransform:'capitalize' }}>{value}</span>
          </div>
        ))}
      </div>
      {isWaitlist ? (
        <div style={{ background:B.purpleLight, borderRadius:12, padding:14, fontSize:13, color:B.dark, marginTop:16 }}>
          ℹ️ You'll receive an email at <strong>{form.email}</strong> if a spot becomes available. You'll have 2 hours to confirm.
        </div>
      ) : (
        <div style={{ background:B.orangeLight, borderRadius:12, padding:14, fontSize:13, color:B.dark, marginTop:16 }}>
          ℹ️ Confirmation will be sent to <strong>{form.email}</strong>. Please arrive within 15 minutes of your booking time.
        </div>
      )}
    </div>
  )
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({ form, date, time, guests, isWaitlist }) {
  return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontSize:60, marginBottom:16 }}>{isWaitlist ? '⏳' : '🎉'}</div>
      <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:26, color:B.dark, marginBottom:10 }}>
        {isWaitlist ? "You're on the waitlist!" : 'Reservation confirmed!'}
      </h2>
      <p style={{ color:B.gray, fontSize:15, marginBottom:28, lineHeight:1.7 }}>
        {isWaitlist
          ? <>Thank you, <strong>{form.first_name}</strong>. We'll email you if a spot opens up for<br/><strong style={{ color:B.purple, textTransform:'capitalize' }}>{fmtDate(date)} at {time}</strong></>
          : <>Thank you, <strong>{form.first_name}</strong>. We look forward to seeing you on<br/><strong style={{ color:B.orange, textTransform:'capitalize' }}>{fmtDate(date)} at {time}</strong></>
        }
      </p>
      <div style={{ ...cardStyle, display:'flex', justifyContent:'space-around', marginBottom:20 }}>
        {[['📅', fmtDate(date).split(',')[0]], ['⏰', time], ['👥', `${guests} guest${guests>1?'s':''}`]].map(([icon,val])=>(
          <div key={val} style={{ textAlign:'center' }}>
            <div style={{ fontSize:24 }}>{icon}</div>
            <div style={{ fontSize:12, fontWeight:600, color:B.dark, marginTop:4, textTransform:'capitalize' }}>{val}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize:12, color:B.gray }}>
        {isWaitlist ? 'Waitlist confirmation sent to' : 'Booking confirmation sent to'} <strong>{form.email}</strong>
      </p>
    </div>
  )
}

// ─── Waitlist flow ────────────────────────────────────────────────────────────

function WaitlistFlow({ date, time, onBack }) {
  const [step,    setStep]    = useState(0) // 0=details, 1=confirm
  const [form,    setForm]    = useState({ first_name:'', last_name:'', email:'', phone:'' })
  const [done,    setDone]    = useState(false)
  const [loading, setLoading] = useState(false)
  const upd = (k,v) => setForm(f=>({...f,[k]:v}))

  const canNext = form.first_name && form.last_name && form.email && form.phone

  const submit = async () => {
    setLoading(true)
    try {
      const entry = await addToWaitlist({
        date: toISO(date), time: time+':00',
        guests: 2,
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone,
      })
      await sendEmail('waitlist_confirmation', { entry })
      setDone(true)
    } finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontSize:60, marginBottom:16 }}>⏳</div>
      <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:24, color:B.dark, marginBottom:10 }}>You're on the waitlist!</h2>
      <p style={{ color:B.gray, fontSize:14, lineHeight:1.7 }}>
        We'll email <strong>{form.email}</strong> if a spot opens up for<br/>
        <strong style={{ color:B.purple, textTransform:'capitalize' }}>{fmtDate(date)} at {time}</strong>
      </p>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', color:B.gray, fontSize:14 }}>← Back</button>
        <span style={{ background:B.purpleLight, color:B.purple, padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>⏳ Joining waitlist for {time}</span>
      </div>

      {step === 0 && (
        <>
          <DetailsStep form={form} onChange={upd} isWaitlist />
          <div style={{ marginTop:24 }}>
            <Btn onClick={()=>setStep(1)} disabled={!canNext} style={{ width:'100%' }}>Review →</Btn>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <SummaryStep date={date} time={time} guests={2} form={form} isWaitlist />
          <div style={{ display:'flex', gap:12, marginTop:24 }}>
            <Btn variant="secondary" onClick={()=>setStep(0)} style={{ flex:1 }}>← Back</Btn>
            <Btn variant="waitlist" onClick={submit} disabled={loading} style={{ flex:2 }}>
              {loading ? 'Joining…' : '⏳ Join waitlist'}
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const titleStyle = { textAlign:'center', fontSize:22, fontFamily:'Playfair Display,serif', color:'#FAF6F0', marginBottom:6, fontWeight:600 }
const subStyle   = { textAlign:'center', color:B.gray, fontSize:14, marginBottom:24 }
const cardStyle  = { background:'#fff', borderRadius:16, padding:24, boxShadow:`0 2px 20px rgba(60,66,66,.08)` }
const labelStyle = { display:'block', fontSize:11, fontWeight:700, color:B.dark, marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase' }
const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:`2px solid ${B.grayLight}`, fontSize:14, color:B.dark, outline:'none', transition:'border .2s', background:'#fff' }
const SectionLabel = ({ children }) => <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.gray, marginBottom:12 }}>{children}</div>

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingPage({ breakfastLink = '/breakfast' }) {
  const [step,         setStep]         = useState(0)
  const [date,         setDate]         = useState(null)
  const [time,         setTime]         = useState(null)
  const [guests,       setGuests]       = useState(null)
  const [form,         setForm]         = useState({ first_name:'', last_name:'', email:'', phone:'', notes:'', terms:false })
  const [done,         setDone]         = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [waitlistTime, setWaitlistTime] = useState(null)
  const [openingHours, setOpeningHours] = useState(null)
  const [closedPeriods, setClosedPeriods] = useState([])
  const [minGuests,    setMinGuests]    = useState(1)
  const [maxGuests,    setMaxGuests]    = useState(4)
  const [lunchEnabled, setLunchEnabled] = useState(true)
  const [dinnerEnabled,setDinnerEnabled]= useState(true)

  useEffect(() => {
    getSettings().then(s => {
      try { setOpeningHours(JSON.parse(s.opening_hours || '{}')) } catch {}
      try { setClosedPeriods(JSON.parse(s.closed_periods || '[]')) } catch {}
      setMinGuests(parseInt(s.min_guests_online||1))
      setMaxGuests(parseInt(s.max_guests_online||4))
      setLunchEnabled(s.lunch_enabled !== 'false')
      setDinnerEnabled(s.dinner_enabled !== 'false')
    })
  }, [])

  const upd = (k,v) => setForm(f=>({...f,[k]:v}))

  const canNext = () => {
    if (step===0) return !!date
    if (step===1) return !!time
    if (step===2) return !!guests
    if (step===3) return form.first_name && form.last_name && form.email && form.phone && form.terms
    return true
  }

  const confirm = async () => {
    setLoading(true); setError(null)
    try {
      const r = await createReservation({
        date: toISO(date), time: time+':00', guests,
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone, notes: form.notes,
        status: 'confirmed', is_manual: false,
      })
      await sendEmail('confirmation', { reservation: r })
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  // Waitlist mode
  if (waitlistTime) {
    return (
      <PageWrapper breakfastLink={breakfastLink}>
        <WaitlistFlow date={date} time={waitlistTime} onBack={()=>setWaitlistTime(null)} />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper breakfastLink={breakfastLink}>
      {done ? (
        <SuccessScreen form={form} date={date} time={time} guests={guests} />
      ) : (
        <>
          <Steps step={step} />
          <div>
            {step===0 && <CalendarStep selected={date} onSelect={d=>{setDate(d);setTime(null)}} openingHours={openingHours} closedPeriods={closedPeriods} />}
            {step===1 && <TimeStep selected={time} onSelect={setTime} date={date} openingHours={openingHours}
              lunchEnabled={lunchEnabled} dinnerEnabled={dinnerEnabled}
              onJoinWaitlist={t=>{ setWaitlistTime(t) }} />}
            {step===2 && <GuestsStep guests={guests} onSelect={setGuests} min={minGuests} max={maxGuests}/>}
            {step===3 && <DetailsStep form={form} onChange={upd} />}
            {step===4 && <SummaryStep date={date} time={time} guests={guests} form={form} />}
          </div>
          {error && <p style={{ color:B.red, fontSize:13, textAlign:'center', marginTop:12 }}>{error}</p>}
          <div style={{ display:'flex', gap:12, marginTop:28 }}>
            {step>0 && <Btn variant="secondary" onClick={()=>setStep(s=>s-1)} style={{ flex:1 }}>← Back</Btn>}
            {step<4 && <Btn onClick={()=>setStep(s=>s+1)} disabled={!canNext()} style={{ flex:2 }}>Continue →</Btn>}
            {step===4 && <Btn onClick={confirm} disabled={loading} style={{ flex:2 }}>
              {loading ? 'Booking…' : '✓ Confirm reservation'}
            </Btn>}
          </div>
        </>
      )}
    </PageWrapper>
  )
}

function PageWrapper({ children, breakfastLink='/breakfast' }) {
  return (
    <div style={{
      minHeight:'100vh',
      position:'relative',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'24px 16px 60px',
    }}>
      {/* Background photo */}
      <div style={{
        position:'fixed', inset:0, zIndex:0,
        backgroundImage:'url(/restaurant.jpg)',
        backgroundSize:'cover', backgroundPosition:'center',
        filter:'brightness(0.35)',
      }}/>
      {/* Content */}
      <div style={{ position:'relative', zIndex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src="/logo.png" alt="Underhuset" style={{ height:110, objectFit:'contain', display:'block', margin:'0 auto' }}/>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', letterSpacing:'.1em', textTransform:'uppercase', marginTop:8 }}>Sakrisøy</div>
        </div>
        <div style={{ width:'100%', maxWidth:520, textAlign:'center', marginBottom:12 }}>
          <a href={breakfastLink} style={{ display:'inline-block', padding:'10px 24px', borderRadius:20, background:'rgba(255,255,255,0.15)', color:'#FAF6F0', fontSize:14, fontWeight:600, textDecoration:'none', border:'1px solid rgba(255,255,255,0.3)', backdropFilter:'blur(4px)' }}>
            🍳 Breakfast?
          </a>
        </div>
        <div style={{
          width:'100%', maxWidth:520,
          background:'transparent',
          borderRadius:24, padding:'28px 24px',
        }}>
          {children}
        </div>
        <p style={{ marginTop:20, fontSize:12, color:'rgba(255,255,255,.6)', textAlign:'center' }}>
          Groups of 5+? <a href="https://underhusetlofoten.com/contact/" target="_blank" rel="noopener noreferrer" style={{ color:B.orange, fontWeight:600 }}>Contact us directly</a>
        </p>
      </div>
    </div>
  )
}
