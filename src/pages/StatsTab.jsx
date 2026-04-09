import { useState, useMemo } from 'react'
import { B } from '../brand.js'

const PERIODS = [
  { id:'7d',     label:'7 days'   },
  { id:'30d',    label:'30 days'  },
  { id:'90d',    label:'90 days'  },
  { id:'custom', label:'Custom'   },
]

const SERVICES = [
  { id:'all',       label:'All',       from:0,  to:24 },
  { id:'breakfast', label:'Breakfast', from:7,  to:11 },
  { id:'lunch',     label:'Lunch',     from:12, to:16 },
  { id:'dinner',    label:'Dinner',    from:18, to:23 },
]

function timeToH(t) {
  if (!t) return 0
  const [h] = t.split(':').map(Number)
  return h
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
      <div style={{ fontSize:11, color:B.gray, marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color:color||B.dark, fontFamily:'Playfair Display,serif' }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:B.gray, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, color, height=120 }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height, paddingBottom:20 }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, height:'100%', justifyContent:'flex-end' }}>
          <div title={`${d.label}: ${d.value}`} style={{
            width:'100%', background:color||B.orange, borderRadius:'4px 4px 0 0',
            height:`${Math.max(2,(d.value/max)*(height-20))}px`,
            minHeight: d.value>0?4:2, opacity: d.value===0?0.15:1,
            transition:'height .3s',
          }}/>
          <div style={{ fontSize:9, color:B.gray, textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function StatsTab({ reservations, breakfast, settings }) {
  const today = new Date()
  const fmt = d => d.toISOString().slice(0,10)

  const [period,    setPeriod]    = useState('30d')
  const [dateFrom,  setDateFrom]  = useState(fmt(new Date(today.getFullYear(), today.getMonth()-1, today.getDate())))
  const [dateTo,    setDateTo]    = useState(fmt(today))
  const [service,   setService]   = useState('all')

  // Compute date range
  const { from, to } = useMemo(() => {
    if (period === 'custom') return { from: dateFrom, to: dateTo }
    const d = new Date()
    const days = period==='7d'?7:period==='30d'?30:90
    d.setDate(d.getDate()-days)
    return { from: fmt(d), to: fmt(today) }
  }, [period, dateFrom, dateTo])

  const svc = SERVICES.find(s=>s.id===service)

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (r.date < from || r.date > to) return false
      if (service !== 'all') {
        const h = timeToH(r.time)
        if (h < svc.from || h >= svc.to) return false
      }
      return true
    })
  }, [reservations, from, to, service])

  const bfiltered = useMemo(() => {
    if (service !== 'all' && service !== 'breakfast') return []
    return breakfast.filter(r => r.date >= from && r.date <= to)
  }, [breakfast, from, to, service])

  // KPIs
  const active     = filtered.filter(r=>!['cancelled','no_show'].includes(r.status))
  const cancelled  = filtered.filter(r=>r.status==='cancelled').length
  const noshow     = filtered.filter(r=>r.status==='no_show').length
  const totalGuests = active.reduce((s,r)=>s+r.guests,0)
  const avgGuests  = active.length > 0 ? (totalGuests/active.length).toFixed(1) : '—'
  const cancelRate = filtered.length > 0 ? Math.round((cancelled/filtered.length)*100) : 0
  const noshowRate = filtered.length > 0 ? Math.round((noshow/filtered.length)*100) : 0
  const bfGuests   = bfiltered.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+r.guests,0)

  // By day of week
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const byDow = Array(7).fill(0)
  active.forEach(r => { byDow[(new Date(r.date).getDay()+6)%7]++ })
  const dowData = DAY_LABELS.map((label,i)=>({ label, value:byDow[i] }))

  // By hour
  const hourMap = {}
  active.forEach(r => {
    if (!r.time) return
    hourMap[r.time] = (hourMap[r.time]||0) + 1
  })
  const hourData = Object.entries(hourMap).sort().map(([label,value])=>({ label, value }))

  // By month (last 6)
  const monthMap = {}
  for (let i=5; i>=0; i--) {
    const d = new Date(today)
    d.setMonth(d.getMonth()-i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    monthMap[key] = { label:d.toLocaleDateString('en-GB',{month:'short'}), value:0 }
  }
  active.forEach(r => {
    const k = r.date?.slice(0,7)
    if (monthMap[k]) monthMap[k].value++
  })
  const monthData = Object.values(monthMap)

  // Breakfast by hotel
  const hotelMap = {}
  bfiltered.filter(r=>r.status!=='cancelled').forEach(r => {
    hotelMap[r.hotel] = (hotelMap[r.hotel]||0) + r.guests
  })
  const hotelData = Object.entries(hotelMap).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({ label:label.split(' ')[0], value }))

  const inputS = { padding:'7px 12px', borderRadius:8, border:`2px solid ${B.grayLight}`, fontSize:13, color:B.dark, outline:'none', background:'#fff', cursor:'pointer' }

  return (
    <div>
      {/* Header + Filters */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, fontWeight:600, marginBottom:16 }}>📈 Statistics</h2>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {/* Period pills */}
          <div style={{ display:'flex', gap:6 }}>
            {PERIODS.map(p=>(
              <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
                padding:'7px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: period===p.id ? B.orange : B.grayLight,
                color: period===p.id ? '#fff' : B.dark,
              }}>{p.label}</button>
            ))}
          </div>

          {/* Custom date range */}
          {period==='custom' && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputS}
                onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
              <span style={{ color:B.gray, fontSize:13 }}>→</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputS}
                onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
          )}

          {/* Service filter */}
          <div style={{ display:'flex', gap:6 }}>
            {SERVICES.map(s=>(
              <button key={s.id} onClick={()=>setService(s.id)} style={{
                padding:'7px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: service===s.id ? B.blue : B.grayLight,
                color: service===s.id ? '#fff' : B.dark,
              }}>
                {s.id==='breakfast'?'🍳':s.id==='lunch'?'☀️':s.id==='dinner'?'🌙':'🍽'} {s.label}
                {s.id!=='all' && <span style={{ opacity:.7, fontSize:10 }}> {s.from}–{s.to}h</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="Reservations"   value={filtered.length} sub={`${active.length} active`}/>
        <StatCard label="Guests served"  value={totalGuests}     color={B.blue}/>
        <StatCard label="Avg party size" value={avgGuests}       sub="guests/booking"/>
        <StatCard label="Cancellations"  value={`${cancelRate}%`} sub={`${cancelled} total`} color={cancelled>0?B.red:B.green}/>
        <StatCard label="No-shows"       value={`${noshowRate}%`} sub={`${noshow} total`}    color={noshow>0?B.orange:B.green}/>
        {(service==='all'||service==='breakfast') && (
          <StatCard label="Breakfast guests" value={bfGuests} color={B.blue} sub="hotel buffet"/>
        )}
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
          <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:12 }}>📅 Bookings by month</div>
          <BarChart data={monthData} color={B.orange} height={140}/>
        </div>
        <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
          <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:12 }}>📆 Bookings by day of week</div>
          <BarChart data={dowData} color={B.blue} height={140}/>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
          <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:12 }}>🕐 Popular time slots</div>
          {hourData.length > 0
            ? <BarChart data={hourData} color={B.orange} height={140}/>
            : <div style={{ color:B.gray, fontSize:13, paddingTop:40, textAlign:'center' }}>No data for this filter</div>}
        </div>
        {(service==='all'||service==='breakfast') && (
          <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
            <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:12 }}>🍳 Breakfast by hotel</div>
            {hotelData.length > 0
              ? <BarChart data={hotelData} color={B.blue} height={140}/>
              : <div style={{ color:B.gray, fontSize:13, paddingTop:40, textAlign:'center' }}>No breakfast data yet</div>}
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:`0 2px 12px rgba(60,66,66,.07)` }}>
        <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:14 }}>📊 Status breakdown</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            { label:'Confirmed', count:filtered.filter(r=>r.status==='confirmed').length, color:B.blue,   bg:B.blueLight },
            { label:'Seated',    count:filtered.filter(r=>r.status==='seated').length,    color:B.green,  bg:B.greenLight },
            { label:'Cancelled', count:cancelled, color:B.red,    bg:B.redLight },
            { label:'No-show',   count:noshow,    color:B.orange, bg:B.orangeLight },
          ].map(({ label, count, color, bg })=>(
            <div key={label} style={{ background:bg, borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20, fontWeight:700, color }}>{count}</span>
              <span style={{ fontSize:12, color, fontWeight:600 }}>{label}</span>
            </div>
          ))}
        </div>
        {filtered.length > 0 && (
          <div style={{ marginTop:14, height:8, borderRadius:20, overflow:'hidden', display:'flex' }}>
            {[
              { v:active.length, c:B.green },
              { v:cancelled,     c:B.red   },
              { v:noshow,        c:B.orange },
            ].filter(x=>x.v>0).map(({ v, c },i) => (
              <div key={i} style={{ flex:v, background:c }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
