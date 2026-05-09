import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { B, STATUS_COLOR, ALL_TIMES, MONTHS_EN, DAYS_SHORT, DAY_KEYS, DAY_NAMES, BLOCK_HOURS } from '../brand.js'
import StatsTab from './StatsTab.jsx'
import {
  getReservations, createReservation, updateReservation, deleteReservation, getDeletedReservations, restoreReservation,
  getTags, createTag, updateTag, deleteTag,
  seatReservation, earlyFreeReservation,
  getTables, createTable, updateTable, deleteTable,
  getSettings, setSetting, getOccupiedTablesForSlot,
  getWaitlist, updateWaitlistEntry, deleteWaitlistEntry, getNextWaiting,
  getBreakfastReservations, createBreakfastReservation, updateBreakfastReservation, deleteBreakfastReservation,
  sendEmail,
} from '../lib/supabase.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayISO() { return toISO(new Date()) }
function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})
}
function fmtTime(t) { return t ? t.slice(0,5) : '' }

// Returns label for one or multiple tables
function tableLabel(r, tables) {
  if (r.table_ids && r.table_ids.length > 0) {
    const names = r.table_ids.map(id => tables.find(t=>t.id===id)?.name).filter(Boolean)
    if (names.length > 0) return names.join('+')
  }
  if (r.table) return r.table.name
  return null
}

function TableCell({ r, tables }) {
  const label = tableLabel(r, tables)
  if (!label) return <span style={{ color:B.grayLight }}>—</span>
  return <span style={{ background:B.blueLight, color:B.blue, padding:'2px 8px', borderRadius:6, fontSize:15, fontWeight:700 }}>{label}</span>
}
function timeToH(t) {
  if (!t) return 0
  const clean = t.replace(':00','')
  const [h,m] = clean.split(':').map(Number)
  return h + m/60
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const S = {
  card:  { background:'#fff', borderRadius:16, padding:24, boxShadow:`0 2px 16px rgba(60,66,66,.07)` },
  label: { display:'block', fontSize:11, fontWeight:700, color:B.dark, marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase' },
  input: { width:'100%', padding:'10px 14px', borderRadius:10, border:`2px solid ${B.grayLight}`, fontSize:14, color:B.dark, outline:'none', transition:'border .2s', background:'#fff' },
  th:    { padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:B.gray, borderBottom:`2px solid ${B.grayLight}` },
  td:    { padding:'12px 14px', fontSize:13, color:B.dark, borderBottom:`1px solid ${B.grayLight}`, verticalAlign:'middle' },
}

function Btn({ children, onClick, variant='primary', size='md', disabled=false, style={} }) {
  const base = { border:'none', borderRadius:10, fontWeight:600, cursor:disabled?'not-allowed':'pointer',
    transition:'all .16s', fontSize:size==='sm'?12:14, padding:size==='sm'?'6px 12px':'10px 18px', ...style }
  const v = {
    primary:   { background:disabled?B.grayLight:B.orange, color:disabled?B.gray:'#fff' },
    secondary: { background:'#fff', color:B.dark, border:`2px solid ${B.grayLight}` },
    danger:    { background:disabled?B.grayLight:B.redLight, color:disabled?B.gray:B.red, border:`1px solid ${B.red}` },
    ghost:     { background:'transparent', color:B.gray },
    success:   { background:B.greenLight, color:B.green, border:`1px solid ${B.green}` },
    purple:    { background:B.purpleLight, color:B.purple, border:`1px solid ${B.purple}` },
    walkin:    { background:B.dark, color:'#fff' },
  }
  return (
    <button style={{...base,...v[variant]}} disabled={disabled} onClick={onClick}
      onMouseEnter={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orangeDark }}
      onMouseLeave={e=>{ if(!disabled&&variant==='primary') e.currentTarget.style.background=B.orange }}>
      {children}
    </button>
  )
}

function Badge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending
  return <span style={{ background:c.bg, color:c.text, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:'.04em' }}>{c.label}</span>
}

function Input({ label, value, onChange, type='text', placeholder='', style={} }) {
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{...S.input,...style}}
        onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight} />
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} style={{...S.input, cursor:'pointer', appearance:'auto'}}>
        {options.map(o=><option key={o.value} value={o.value} disabled={o.disabled}
          style={{ color:o.disabled?'#aaa':'inherit' }}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
      <div style={{ width:44, height:24, borderRadius:12, position:'relative',
        background:checked?B.orange:B.grayLight, transition:'background .2s', flexShrink:0 }}
        onClick={()=>onChange(!checked)}>
        <div style={{ position:'absolute', top:2, left:checked?20:2, width:20, height:20,
          borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.2)' }}/>
      </div>
      <span style={{ fontSize:14, color:B.dark }}>{label}</span>
    </label>
  )
}

function Modal({ title, onClose, children, width=560 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(60,66,66,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:width, maxHeight:'90vh',
        overflow:'auto', boxShadow:`0 20px 60px rgba(0,0,0,.2)` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:`1px solid ${B.grayLight}` }}>
          <h3 style={{ fontFamily:'Playfair Display,serif', fontSize:18, color:B.dark, fontWeight:600 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:B.gray }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  )
}

function Confirm({ message, onYes, onNo, yesLabel='Delete', yesVariant='danger' }) {
  return (
    <Modal title="Confirm action" onClose={onNo} width={400}>
      <p style={{ color:B.darkSoft, fontSize:14, marginBottom:24, lineHeight:1.6 }}>{message}</p>
      <div style={{ display:'flex', gap:12 }}>
        <Btn variant="secondary" onClick={onNo} style={{ flex:1 }}>Cancel</Btn>
        <Btn variant={yesVariant} onClick={onYes} style={{ flex:1 }}>{yesLabel}</Btn>
      </div>
    </Modal>
  )
}

function QuickActions({ reservation, onSeated, onEarlyFree, onEdit }) {
  const s = reservation.status
  return (
    <div style={{ display:'flex', gap:5, flexWrap:'nowrap' }}>
      {(s==='pending'||s==='confirmed') && (
        <Btn size="sm" variant="success" onClick={()=>onSeated(reservation)}>▶ Seat</Btn>
      )}
      {s==='seated' && (
        <Btn size="sm" onClick={()=>onEarlyFree(reservation)}
          style={{ background:B.purpleLight, color:B.purple, border:`1px solid ${B.purple}` }}>
          🚪 Early free
        </Btn>
      )}
      <Btn size="sm" variant="ghost" onClick={()=>onEdit(reservation)}>Edit</Btn>
    </div>
  )
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ selected, onSelect }) {
  const today = new Date()
  const [y, setY] = useState(selected ? new Date(selected+'T00:00:00').getFullYear() : today.getFullYear())
  const [m, setM] = useState(selected ? new Date(selected+'T00:00:00').getMonth()    : today.getMonth())

  const days  = new Date(y,m+1,0).getDate()
  const first = (new Date(y,m,1).getDay()+6)%7
  const isSel = day => {
    if (!selected) return false
    const d = new Date(selected+'T00:00:00')
    return d.getFullYear()===y && d.getMonth()===m && d.getDate()===day
  }
  const isTod = day => today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===day

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:16, boxShadow:`0 2px 12px rgba(60,66,66,.08)` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={()=>m===0?(setY(y-1),setM(11)):setM(m-1)}
          style={{ background:'none',border:'none',cursor:'pointer',fontSize:18,color:B.dark,padding:'2px 8px',borderRadius:6 }}>‹</button>
        <span style={{ fontSize:13, fontWeight:700, color:B.dark }}>{MONTHS_EN[m].slice(0,3)} {y}</span>
        <button onClick={()=>m===11?(setY(y+1),setM(0)):setM(m+1)}
          style={{ background:'none',border:'none',cursor:'pointer',fontSize:18,color:B.dark,padding:'2px 8px',borderRadius:6 }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:'center',fontSize:9,fontWeight:700,color:B.gray,letterSpacing:'.06em',textTransform:'uppercase' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {Array(first).fill(null).map((_,i)=><div key={'e'+i}/>)}
        {Array(days).fill(null).map((_,i)=>{
          const day=i+1, sel=isSel(day), tod=isTod(day)
          const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          return (
            <button key={day} onClick={()=>onSelect(iso)} style={{
              aspectRatio:'1', border:'none', borderRadius:6,
              background:sel?B.orange:tod?B.orangeLight:'transparent',
              color:sel?'#fff':B.dark, fontSize:12, fontWeight:sel||tod?700:400, cursor:'pointer',
              outline:tod&&!sel?`2px solid ${B.orange}`:'none',
            }}>{day}</button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Reservation Form ─────────────────────────────────────────────────────────

const EMPTY_FORM = { date:'', time:'', guests:2, first_name:'', last_name:'', email:'', phone:'', notes:'', merged_with:'', status:'confirmed', table_ids:[], tag_ids:[], is_manual:true }

function TableSelector({ tables, selectedIds, occupiedIds, onChange }) {
  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x=>x!==id) : [...selectedIds, id]
    onChange(next)
  }
  const interior = tables.filter(t=>t.is_active&&t.zone==='interior')
  const exterior = tables.filter(t=>t.is_active&&t.zone==='exterior')
  const totalSelected = tables.filter(t=>selectedIds.includes(t.id)).reduce((s,t)=>s+t.capacity,0)

  const TableBtn = ({ t }) => {
    const occupied = occupiedIds.includes(t.id) && !selectedIds.includes(t.id)
    const selected = selectedIds.includes(t.id)
    return (
      <button disabled={occupied} onClick={()=>!occupied&&toggle(t.id)} style={{
        padding:'8px 12px', borderRadius:10, fontSize:12, fontWeight:600,
        border:`2px solid ${selected?B.orange:occupied?B.grayLight:B.grayLight}`,
        background:selected?B.orange:occupied?'#f5f5f5':'#fff',
        color:selected?'#fff':occupied?B.grayLight:B.dark,
        cursor:occupied?'not-allowed':'pointer', transition:'all .15s',
        display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      }}
        onMouseEnter={e=>{ if(!occupied&&!selected){e.currentTarget.style.borderColor=B.orange;e.currentTarget.style.background=B.orangeLight} }}
        onMouseLeave={e=>{ if(!selected){e.currentTarget.style.borderColor=B.grayLight;e.currentTarget.style.background=occupied?'#f5f5f5':'#fff'} }}>
        <span>{t.name}</span>
        <span style={{ fontSize:10, opacity:.7 }}>{t.capacity}p{occupied?' ●':''}</span>
      </button>
    )
  }

  return (
    <div>
      <label style={S.label}>
        Assign tables
        {selectedIds.length>0 && <span style={{ marginLeft:8, color:B.orange }}>{selectedIds.length} selected · {totalSelected}p total</span>}
      </label>
      {interior.length>0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:B.gray, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>Interior</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{interior.map(t=><TableBtn key={t.id} t={t}/>)}</div>
        </div>
      )}
      {exterior.length>0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:B.gray, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>Exterior</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{exterior.map(t=><TableBtn key={t.id} t={t}/>)}</div>
        </div>
      )}
      {selectedIds.length>1 && (
        <div style={{ marginTop:8, padding:'6px 12px', background:B.orangeLight, borderRadius:8, fontSize:12, color:B.dark }}>
          Combined: {tables.filter(t=>selectedIds.includes(t.id)).map(t=>t.name).join(' + ')} = {totalSelected}p max
        </div>
      )}
    </div>
  )
}

function ReservationForm({ initial={}, tables=[], tags=[], onSave, onCancel, loading }) {
  const initTableIds = initial.table_ids || (initial.table_id ? [initial.table_id] : [])
  const initTagIds = (() => {
    try {
      const v = initial.tag_ids
      if (!v || v === '[]' || v === 'null') return []
      if (Array.isArray(v)) return v
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) return parsed
      return []
    } catch { return [] }
  })()
  const [f,           setF]           = useState({ ...EMPTY_FORM, ...initial, table_ids: initTableIds, tag_ids: initTagIds })
  const [occupiedIds, setOccupiedIds] = useState([])
  const upd = (k,v) => setF(p=>({...p,[k]:v}))

  useEffect(() => {
    if (!f.date || !f.time) { setOccupiedIds([]); return }
    getOccupiedTablesForSlot(f.date, f.time).then(ids => {
      setOccupiedIds(ids.filter(id=>!initTableIds.includes(id)))
    })
  }, [f.date, f.time])

  const valid = f.date && f.time && f.guests && f.first_name && f.email && f.phone

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div>
        <label style={S.label}>Date *</label>
        <input type="date" value={f.date} onChange={e=>upd('date',e.target.value)}
          style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
      </div>
      <div>
        <Select label="Time *" value={f.time} onChange={v=>upd('time',v)} options={[
          { value:'', label:'Select…' },
          ...ALL_TIMES.map(t=>({ value:t+':00', label:t }))
        ]}/>
      </div>
      <div>
        <label style={S.label}>Guests *</label>
        <input type="number" min={1} max={50} value={f.guests} onChange={e=>upd('guests',parseInt(e.target.value)||1)}
          style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
      </div>
      <div>
        <Select label="Status" value={f.status} onChange={v=>upd('status',v)} options={
          Object.entries(STATUS_COLOR).map(([k,v])=>({ value:k, label:v.label }))
        }/>
      </div>
      <div><Input label="First name *" value={f.first_name} onChange={v=>upd('first_name',v)} /></div>
      <div><Input label="Last name"  value={f.last_name}  onChange={v=>upd('last_name',v)} /></div>
      <div style={{ gridColumn:'1/-1' }}><Input label="Email *" type="email" value={f.email} onChange={v=>upd('email',v)} /></div>
      <div style={{ gridColumn:'1/-1' }}><Input label="Phone *" type="tel" value={f.phone} onChange={v=>upd('phone',v)} /></div>
      <div style={{ gridColumn:'1/-1' }}>
        <TableSelector tables={tables} selectedIds={f.table_ids||[]} occupiedIds={occupiedIds} onChange={ids=>upd('table_ids',ids)}/>
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <label style={S.label}>Internal notes</label>
        <textarea value={f.notes||''} onChange={e=>upd('notes',e.target.value)} rows={3}
          style={{...S.input, resize:'vertical'}}
          onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <label style={S.label}>🏷️ Tags</label>
        <TagSelector tags={tags} selectedIds={f.tag_ids||[]} onChange={ids=>upd('tag_ids',ids)}/>
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <label style={S.label}>🔗 Merged with</label>
        <input value={f.merged_with||''} onChange={e=>upd('merged_with',e.target.value)}
          placeholder="Name of merged reservation"
          style={S.input}
          onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
      </div>
      <div style={{ gridColumn:'1/-1', display:'flex', gap:12 }}>
        <Btn variant="secondary" onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
        <Btn onClick={()=>onSave(f)} disabled={!valid||loading} style={{ flex:2 }}>
          {loading ? 'Saving…' : '✓ Save reservation'}
        </Btn>
      </div>
    </div>
  )
}

// ─── Walk-in Modal ────────────────────────────────────────────────────────────

function WalkInModal({ tables, onSave, onClose, loading }) {
  const [guests,   setGuests]   = useState(2)
  const [tableId,  setTableId]  = useState('')
  const [name,     setName]     = useState('')

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(Math.floor(now.getMinutes()/15)*15).padStart(2,'0')}:00`

  const activeTables = tables.filter(t=>t.is_active)
  const tableOptions = [
    { value:'', label:'Not assigned' },
    ...activeTables.filter(t=>t.zone==='interior').map(t=>({ value:t.id, label:`${t.name} (interior, ${t.capacity}p)` })),
    ...activeTables.filter(t=>t.zone==='exterior').map(t=>({ value:t.id, label:`${t.name} (exterior, ${t.capacity}p)` })),
  ]

  const save = () => onSave({
    date: todayISO(), time: timeStr, guests,
    first_name: name || 'Walk-in', last_name: '', email: 'walkin@underhuset.no', phone: '-',
    status: 'seated', is_manual: true, table_id: tableId || null,
    notes: 'Walk-in', seated_at: new Date().toISOString(),
  })

  return (
    <Modal title="🚶 Walk-in" onClose={onClose} width={400}>
      <div style={{ display:'grid', gap:16 }}>
        <div>
          <label style={S.label}>Name (optional)</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Guest name"
            style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Guests *</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setGuests(n)} style={{
                padding:'10px', borderRadius:10, border:`2px solid ${guests===n?B.orange:B.grayLight}`,
                background:guests===n?B.orange:'#fff', color:guests===n?'#fff':B.dark,
                fontWeight:700, fontSize:16, cursor:'pointer',
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:8 }}>
            {[6,7,8,9].map(n=>(
              <button key={n} onClick={()=>setGuests(n)} style={{
                padding:'10px', borderRadius:10, border:`2px solid ${guests===n?B.orange:B.grayLight}`,
                background:guests===n?B.orange:'#fff', color:guests===n?'#fff':B.dark,
                fontWeight:700, fontSize:16, cursor:'pointer',
              }}>{n}</button>
            ))}
          </div>
        </div>
        <Select label="Table" value={tableId} onChange={setTableId} options={tableOptions}/>
        <div style={{ background:B.orangePale, borderRadius:10, padding:12, fontSize:12, color:B.darkSoft }}>
          ⏰ Arrival time: <strong>{new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</strong> · Status will be set to <strong>Seated</strong>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
          <Btn variant="walkin" onClick={save} disabled={loading} style={{ flex:2 }}>
            {loading ? 'Adding…' : '🚶 Add walk-in'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

const TL_START = 11.5, TL_END = 22.5, TL_RANGE = TL_END - TL_START
const STATUS_TL = {
  pending:    { bg:'#FEF3C7', border:'#F59E0B', text:'#92400E' },
  confirmed:  { bg:'#D1FAE5', border:'#10B981', text:'#065F46' },
  seated:     { bg:'#DBEAFE', border:'#3B82F6', text:'#1E3A8A' },
  early_free: { bg:'#EDE9FE', border:'#7C3AED', text:'#4C1D95' },
  completed:  { bg:'#F3F4F6', border:'#9CA3AF', text:'#374151' },
  no_show:    { bg:'#FEE2E2', border:'#EF4444', text:'#7F1D1D' },
}
function tlPct(h)  { return Math.max(0,Math.min(100,(h-TL_START)/TL_RANGE*100)) }
function hLabel(h) { const hr=Math.floor(h); const mn=Math.round((h-hr)*60); return `${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}` }

function Timeline({ reservations, onEdit }) {
  const [now,     setNow]     = useState(new Date())
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const sorted = [...reservations].filter(r=>r.status!=='cancelled').sort((a,b)=>a.time.localeCompare(b.time))
  if (sorted.length === 0) return null

  const nowH       = now.getHours() + now.getMinutes()/60
  const nowPct     = tlPct(nowH)
  const nowVisible = nowH >= TL_START && nowH <= TL_END
  const ROW_H = 38, ROW_GAP = 5, HEADER_H = 28, LABEL_W = 120
  const markers = []
  for (let h=TL_START; h<=TL_END; h+=0.5) markers.push(h)

  return (
    <div style={{ ...S.card, padding:'16px 20px', marginBottom:24, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h3 style={{ fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.gray }}>⏱ Today's Timeline</h3>
        {nowVisible && <span style={{ fontSize:12, fontWeight:700, color:B.red, background:B.redLight, padding:'3px 10px', borderRadius:20 }}>🔴 Now: {hLabel(nowH)}</span>}
      </div>
      <div style={{ overflowX:'auto' }}>
        <div style={{ position:'relative', minWidth:700 }}>
          <div style={{ position:'relative', height:HEADER_H, marginLeft:LABEL_W }}>
            {markers.filter(h=>h%1===0).map(h=>(
              <div key={h} style={{ position:'absolute', left:`${tlPct(h)}%`, top:0, transform:'translateX(-50%)', fontSize:10, fontWeight:700, color:B.gray, whiteSpace:'nowrap' }}>
                {hLabel(h)}
              </div>
            ))}
            {markers.map(h=>(
              <div key={`t${h}`} style={{ position:'absolute', left:`${tlPct(h)}%`, bottom:0, width:1, height:h%1===0?8:4, background:B.grayLight, transform:'translateX(-50%)' }}/>
            ))}
          </div>
          <div style={{ position:'relative' }}>
            {markers.filter(h=>h%1===0).map(h=>(
              <div key={`g${h}`} style={{ position:'absolute', top:0, bottom:0,
                left:`calc(${LABEL_W}px + ${tlPct(h)/100} * (100% - ${LABEL_W}px))`, width:1, background:B.grayLight, pointerEvents:'none' }}/>
            ))}
            {sorted.map((r) => {
              const startH  = timeToH(r.time)
              const endH    = startH + BLOCK_HOURS
              const leftPct = tlPct(startH)
              const wPct    = Math.min(100, BLOCK_HOURS/TL_RANGE*100)
              const c       = STATUS_TL[r.status] || STATUS_TL.pending
              const progress = nowVisible&&nowH>startH&&nowH<endH ? (nowH-startH)/BLOCK_HOURS : null
              const minsLeft  = progress!==null ? Math.round((endH-nowH)*60) : null
              const minsUntil = nowVisible&&nowH<startH&&(startH-nowH)*60<=60 ? Math.round((startH-nowH)*60) : null

              return (
                <div key={r.id} style={{ position:'relative', height:ROW_H, marginBottom:ROW_GAP }}>
                  <div style={{ position:'absolute', left:0, top:0, width:LABEL_W-8, height:ROW_H, display:'flex', flexDirection:'column', justifyContent:'center', paddingRight:8 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:B.dark, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.first_name} {r.last_name}</span>
                    <span style={{ fontSize:10, color:B.gray }}>{fmtTime(r.time)} · {r.guests}p</span>
                  </div>
                  <div style={{ position:'absolute', left:LABEL_W, right:0, top:'50%', transform:'translateY(-50%)', height:ROW_H-8 }}>
                    <div onClick={()=>onEdit(r)}
                      onMouseEnter={e=>setTooltip({ r, x:e.clientX, y:e.clientY })}
                      onMouseLeave={()=>setTooltip(null)}
                      onMouseMove={e=>setTooltip(t=>t?{...t,x:e.clientX,y:e.clientY}:null)}
                      style={{ position:'absolute', left:`${leftPct}%`, width:`${wPct}%`, height:'100%',
                        background:c.bg, border:`2px solid ${c.border}`, borderRadius:8, cursor:'pointer',
                        display:'flex', alignItems:'center', padding:'0 10px', gap:6, overflow:'hidden', boxSizing:'border-box' }}>
                      {progress!==null && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${progress*100}%`, background:`${c.border}22`, borderRadius:'6px 0 0 6px', pointerEvents:'none' }}/>}
                      {r.table && !r.table_ids?.length && <span style={{ fontSize:10, fontWeight:700, color:c.text, background:`${c.border}33`, padding:'1px 6px', borderRadius:4, flexShrink:0, zIndex:1 }}>{r.table.name}</span>}
                      {r.table_ids?.length>0 && <span style={{ fontSize:10, fontWeight:700, color:c.text, background:`${c.border}33`, padding:'1px 6px', borderRadius:4, flexShrink:0, zIndex:1 }}>{r.table_ids.length}T</span>}                      <span style={{ fontSize:11, fontWeight:600, color:c.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', zIndex:1 }}>{r.first_name} {r.last_name}</span>
                      {minsLeft!==null && <span style={{ fontSize:10, color:c.text, marginLeft:'auto', flexShrink:0, zIndex:1, opacity:.8 }}>{minsLeft}m left</span>}
                      {minsUntil!==null && <span style={{ fontSize:10, color:c.text, marginLeft:'auto', flexShrink:0, zIndex:1, opacity:.8 }}>in {minsUntil}m</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {nowVisible && (
              <div style={{ position:'absolute', top:-HEADER_H, bottom:0,
                left:`calc(${LABEL_W}px + ${nowPct/100} * (100% - ${LABEL_W}px))`,
                width:2, background:B.red, zIndex:20, pointerEvents:'none', boxShadow:`0 0 8px ${B.red}88` }}>
                <div style={{ position:'absolute', top:HEADER_H-6, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:B.red }}/>
                <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', background:B.red, color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:6, whiteSpace:'nowrap' }}>{hLabel(nowH)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {tooltip && (
        <div style={{ position:'fixed', zIndex:999, left:tooltip.x+14, top:tooltip.y-10,
          background:B.dark, color:'#fff', borderRadius:10, padding:'10px 14px', fontSize:12, lineHeight:1.7,
          boxShadow:`0 4px 20px rgba(0,0,0,.3)`, pointerEvents:'none', maxWidth:220 }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{tooltip.r.first_name} {tooltip.r.last_name}</div>
          <div>⏰ {fmtTime(tooltip.r.time)} – {hLabel(timeToH(tooltip.r.time)+BLOCK_HOURS)}</div>
          <div>👥 {tooltip.r.guests} guests</div>
          {tooltip.r.table && <div>🪑 {tooltip.r.table.name}</div>}
          {tooltip.r.phone && tooltip.r.phone!=='-' && <div>📱 {tooltip.r.phone}</div>}
          {tooltip.r.notes && <div>📝 {tooltip.r.notes}</div>}
          <div style={{ marginTop:4, opacity:.7, fontSize:10 }}>Click to edit</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────



function DiagramView({ todayRes, tables, onEditReservation, onRefresh }) {
  const [dragging, setDragging] = useState(null)
  const [dragOverTable, setDragOverTable] = useState(null)
  const [dragPos, setDragPos] = useState({ x:0, y:0 })
  const [mergePrompt, setMergePrompt] = useState(null)
  const hasMoved = useRef(false)
  const startPos = useRef({ x:0, y:0 })
  const containerRef = useRef(null)
  const rowRefs = useRef({})

  const TL_S = 11.5, TL_E = 22.5, TL_R = TL_E - TL_S
  const ROW_H = 68
  const BLOCK_H = 1.5
  const LABEL_W = 72

  const now = new Date()
  const nowH = now.getHours() + now.getMinutes()/60
  const nowPct = Math.max(0, Math.min(100, (nowH - TL_S) / TL_R * 100))
  const showNow = nowH >= TL_S && nowH <= TL_E

  const interiorTables = tables.filter(t=>t.zone==='interior'&&t.is_active).sort((a,b)=>Number(a.name)-Number(b.name))
  const exteriorTables = tables.filter(t=>t.zone==='exterior'&&t.is_active).sort((a,b)=>Number(a.name)-Number(b.name))
  const allTables = [...interiorTables, ...exteriorTables]

  const activeRes = todayRes.filter(r=>!['no_show','cancelled','completed'].includes(r.status))
  const getResForTable = (tableId) => activeRes.filter(r => r.table_id === tableId)

  const timeToH = t => { const [h,m] = t.split(':').map(Number); return h + m/60 }
  const pct = h => Math.max(0, Math.min(100, (h - TL_S) / TL_R * 100))

  const hours = []
  for (let h = Math.ceil(TL_S); h <= TL_E; h++) hours.push(h)

  const statusColor = {
    pending:   { bg:'#FEF3C7', border:'#F59E0B', text:'#92400E' },
    confirmed: { bg:'#D1FAE5', border:'#10B981', text:'#065F46' },
    seated:    { bg:'#DBEAFE', border:'#3B82F6', text:'#1E3A8A' },
    early_free:{ bg:'#EDE9FE', border:'#7C3AED', text:'#4C1D95' },
  }

  const doSwap = async (targetTableId) => {
    if (!dragging || dragging.table_id === targetTableId) return
    const dRes = getResForTable(targetTableId)
    const dTime = timeToH(dragging.time)
    const conflict = dRes.find(r => Math.abs(timeToH(r.time) - dTime) < BLOCK_H)
    if (conflict) {
      setMergePrompt({ source: dragging, conflict, targetTableId })
    } else {
      await updateReservation(dragging.id, { table_id: targetTableId })
      onRefresh()
    }
  }

  const doMerge = async () => {
    if (!mergePrompt) return
    const { source, conflict, targetTableId } = mergePrompt
    await updateReservation(source.id, { table_id: targetTableId, is_absorbed: true })
    await updateReservation(conflict.id, { merged_with: `${source.first_name} ${source.last_name||''}`.trim() })
    setMergePrompt(null)
    setDragging(null)
    setDragOverTable(null)
    onRefresh()
  }

  const doSwapConfirm = async () => {
    if (!mergePrompt) return
    const { source, conflict, targetTableId } = mergePrompt
    await updateReservation(source.id, { table_id: targetTableId })
    await updateReservation(conflict.id, { table_id: source.table_id })
    setMergePrompt(null)
    setDragging(null)
    setDragOverTable(null)
    onRefresh()
  }

  const onPointerDown = (e, r) => {
    e.preventDefault()
    hasMoved.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    setDragging(r)
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  const onPointerMove = (e) => {
    if (!dragging) return
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > 8 || dy > 8) hasMoved.current = true
    if (!hasMoved.current) return
    setDragPos({ x: e.clientX, y: e.clientY })
    // Find which table row we're over
    for (const [tableId, el] of Object.entries(rowRefs.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setDragOverTable(tableId)
        return
      }
    }
    setDragOverTable(null)
  }

  const onPointerUp = async (e) => {
    if (!hasMoved.current && dragging) {
      onEditReservation(dragging)
      setDragging(null)
      setDragOverTable(null)
      return
    }
    if (dragging && dragOverTable && dragOverTable !== dragging.table_id) {
      await doSwap(dragOverTable)
    }
    setDragging(null)
    setDragOverTable(null)
  }

  const TableRow = ({ table }) => {
    const resos = getResForTable(table.id)
    const isOver = dragOverTable === table.id
    const isBlocked = table.is_blocked

    return (
      <div ref={el=>rowRefs.current[table.id]=el}
        style={{ display:'flex', height:ROW_H, borderBottom:`1px solid ${B.grayLight}`, background: isOver&&dragging ? B.orangePale : '#fff', transition:'background .1s', position:'relative' }}>
        <div style={{ width:LABEL_W, minWidth:LABEL_W, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRight:`1px solid ${B.grayLight}`, background:'#FAFAFA', gap:2, flexShrink:0 }}>
          <span style={{ fontWeight:700, fontSize:14, color:B.dark }}>#{table.name}</span>
          <span style={{ fontSize:10, color:B.gray }}>👥{table.capacity}</span>
          {isBlocked && <span style={{ fontSize:9, color:'#9CA3AF', background:'#F3F4F6', borderRadius:4, padding:'1px 4px' }}>staff</span>}
        </div>
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {hours.map(h=>(
            <div key={h} style={{ position:'absolute', left:`${pct(h)}%`, top:0, bottom:0, width:1, background:'#F0F0F0' }}/>
          ))}
          {showNow && <div style={{ position:'absolute', left:`${nowPct}%`, top:0, bottom:0, width:2, background:'rgba(239,68,68,0.5)', zIndex:3 }}/>}
          {resos.map(r=>{
            const h = timeToH(r.time)
            const left = pct(h)
            const width = Math.min(100-left, BLOCK_H/TL_R*100)
            const c = statusColor[r.status] || statusColor.confirmed
            const isDragging = dragging?.id === r.id
            return (
              <div key={r.id}
                onPointerDown={e=>onPointerDown(e,r)}

                style={{
                  position:'absolute', left:`${left}%`, width:`calc(${width}% - 4px)`,
                  top:6, bottom:6, background:c.bg, border:`2px solid ${c.border}`,
                  borderRadius:8, padding:'3px 6px', cursor:isDragging?'grabbing':'grab',
                  opacity:isDragging?0.3:1, transition:'opacity .1s', zIndex:2,
                  display:'flex', flexDirection:'column', justifyContent:'center', touchAction:'none',
                }}>
                <div style={{ fontSize:11, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.first_name} {r.last_name||''}</div>
                <div style={{ fontSize:10, color:c.text, opacity:0.8 }}>{fmtTime(r.time)} · {r.guests}p</div>
                {r.merged_with && <div style={{ fontSize:10, color:c.text, fontWeight:700, background:'rgba(0,0,0,0.08)', borderRadius:4, padding:'1px 4px', marginTop:2 }}>🔗 +{r.merged_with}</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ touchAction:'none' }}>
      {mergePrompt && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:380, width:'90%', boxShadow:'0 8px 40px rgba(0,0,0,.3)' }}>
            <h3 style={{ fontFamily:'Playfair Display,serif', fontSize:18, color:'#3C4242', marginBottom:8 }}>Table conflict</h3>
            <p style={{ fontSize:14, color:'#8A8F8F', marginBottom:20 }}>
              <strong>{mergePrompt.source.first_name}</strong> → Table #{mergePrompt.conflict.table_id ? tables.find(t=>t.id===mergePrompt.conflict.table_id)?.name : '?'} is occupied by <strong>{mergePrompt.conflict.first_name}</strong>. What would you like to do?
            </p>
            <div style={{ display:'grid', gap:10 }}>
              <button onClick={doMerge} style={{ padding:'12px 16px', borderRadius:10, border:'2px solid #F99D54', background:'#FEF4EB', color:'#3C4242', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'left' }}>
                🔗 Merge — {mergePrompt.source.first_name} joins {mergePrompt.conflict.first_name}'s table. Both names kept.
              </button>
              <button onClick={doSwapConfirm} style={{ padding:'12px 16px', borderRadius:10, border:'2px solid #E2E6E6', background:'#fff', color:'#3C4242', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'left' }}>
                🔄 Swap — Exchange tables between both reservations.
              </button>
              <button onClick={()=>{ setMergePrompt(null); setDragging(null); setDragOverTable(null) }} style={{ padding:'10px 16px', borderRadius:10, border:'none', background:'#F3F4F6', color:'#8A8F8F', fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating drag ghost */}
      {dragging && (
        <div style={{ position:'fixed', left:dragPos.x+12, top:dragPos.y-20, zIndex:9999, background:B.orange, color:'#fff', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:700, pointerEvents:'none', boxShadow:'0 4px 12px rgba(0,0,0,.2)' }}>
          {dragging.first_name} · #{tables.find(t=>t.id===dragging.table_id)?.name}
        </div>
      )}

      <div ref={containerRef} style={{ ...S.card, padding:0, overflow:'auto', userSelect:'none' }}>
        {/* Time header */}
        <div style={{ display:'flex', borderBottom:`2px solid ${B.grayLight}`, background:'#FAFAFA', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:`1px solid ${B.grayLight}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:B.gray, flexShrink:0 }}>TABLE</div>
          <div style={{ flex:1, position:'relative', height:32 }}>
            {hours.map(h=>(
              <div key={h} style={{ position:'absolute', left:`${pct(h)}%`, top:0, bottom:0 }}>
                <div style={{ width:1, height:8, background:B.grayLight, marginBottom:2 }}/>
                <span style={{ fontSize:10, fontWeight:700, color:B.gray, marginLeft:2 }}>{String(h).padStart(2,'0')}:00</span>
              </div>
            ))}
            {showNow && (
              <div style={{ position:'absolute', left:`${nowPct}%`, top:0, bottom:0, width:2, background:'#EF4444', zIndex:5 }}>
                <span style={{ position:'absolute', top:2, left:4, fontSize:9, fontWeight:700, color:'#EF4444', whiteSpace:'nowrap' }}>NOW</span>
              </div>
            )}
          </div>
        </div>

        {/* Interior */}
        <div style={{ borderBottom:`2px solid ${B.orange}` }}>
          <div style={{ padding:'3px 8px', background:B.orangePale, fontSize:10, fontWeight:700, color:B.orange, textTransform:'uppercase', letterSpacing:'.06em' }}>🏠 Interior</div>
          {interiorTables.map(t=><TableRow key={t.id} table={t}/>)}
        </div>

        {/* Exterior */}
        <div>
          <div style={{ padding:'3px 8px', background:'#F0FDF4', fontSize:10, fontWeight:700, color:'#16A34A', textTransform:'uppercase', letterSpacing:'.06em' }}>🌿 Exterior</div>
          {exteriorTables.map(t=><TableRow key={t.id} table={t}/>)}
        </div>

        <div style={{ padding:'6px 12px', fontSize:11, color:B.gray, borderTop:`1px solid ${B.grayLight}`, background:'#FAFAFA' }}>
          💡 Hold and drag a reservation vertically to move it to another table. Tables will swap if both are occupied.
        </div>
      </div>
    </div>
  )
}


function Dashboard({ reservations, tables, tags=[], onEditReservation, onSeated, onEarlyFree, onWalkIn, onRefresh }) {
  const today     = todayISO()
  const todayRes  = reservations.filter(r=>r.date===today&&r.status!=='cancelled')
  const pending   = todayRes.filter(r=>r.status==='pending').length
  const confirmed = todayRes.filter(r=>r.status==='confirmed').length
  const seated    = todayRes.filter(r=>r.status==='seated').length
  const totalGuests = todayRes.reduce((s,r)=>s+r.guests,0)
  const activeTables = tables.filter(t=>t.is_active&&!t.is_blocked).length

  // Auto no-show: check every 60s
  useEffect(() => {
    const check = async () => {
      const now = new Date()
      const nowMin = now.getHours()*60 + now.getMinutes()
      for (const r of todayRes) {
        if (r.status!=='pending'&&r.status!=='confirmed') continue
        const [h,m] = r.time.split(':').map(Number)
        const resMin = h*60+m
        if (nowMin - resMin >= 15) {
          await updateReservation(r.id, { status:'no_show' })
          await sendEmail('no_show', { reservation: r })
          // Notify waitlist
          const next = await getNextWaiting(r.date, r.time)
          if (next) {
            await updateWaitlistEntry(next.id, { status:'notified', notified_at: new Date().toISOString() })
            await sendEmail('waitlist_spot', { entry: next })
          }
        }
      }
      onRefresh()
    }
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [todayRes])

  const lunch  = todayRes.filter(r=>parseInt(r.time)<16)
  const dinner = todayRes.filter(r=>parseInt(r.time)>=16)

  const Stat = ({ icon, value, label, color=B.dark }) => (
    <div style={{ ...S.card, textAlign:'center', padding:'20px 16px' }}>
      <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:28, fontWeight:700, color, fontFamily:'Playfair Display,serif' }}>{value}</div>
      <div style={{ fontSize:12, color:B.gray, marginTop:4 }}>{label}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, fontWeight:600 }}>
          Today — {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
        </h2>
        <Btn variant="walkin" onClick={onWalkIn}>🚶 Walk-in</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:28 }}>
        <Stat icon="📋" value={todayRes.length} label="Today's bookings" />
        <Stat icon="👥" value={totalGuests}      label="Guests" color={B.orange}/>
        <Stat icon="⏳" value={pending}          label="Pending" color={B.yellow}/>
        <Stat icon="✅" value={confirmed}        label="Confirmed" color={B.green}/>
        <Stat icon="🪑" value={seated}           label="Seated" color={B.blue}/>
        <Stat icon="🍽️"  value={activeTables}    label="Active tables" />
      </div>

      <DiagramView todayRes={todayRes} tables={tables} onEditReservation={onEditReservation} onRefresh={onRefresh}/>

      {[['☀️ Lunch', lunch], ['🌙 Dinner', dinner]].map(([label, list]) => list.length > 0 && (
        <div key={label} style={{ marginBottom:24 }}>
          <h3 style={{ fontSize:13, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:B.gray, marginBottom:12 }}>{label}</h3>
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Time','Name','Guests','Table','Status','Source','Notes',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.sort((a,b)=>a.time.localeCompare(b.time)).map(r=>(
                  <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...S.td, fontWeight:700, fontSize:15}}>{fmtTime(r.time)}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight:700, fontSize:15, cursor:'pointer', color:B.dark }} onClick={()=>onEditReservation(r)}>{r.first_name} {r.last_name}</div>
                      {r.merged_with && <div style={{ fontSize:11, color:'#7C3AED', fontWeight:700 }}>🔗 +{r.merged_with}</div>}
                      <TagBadges tagIds={r.tag_ids} tags={tags}/>
                    </td>
                    <td style={{...S.td, fontSize:15, fontWeight:700}}>👥 {r.guests}</td>
                    <td style={{...S.td, fontSize:15, fontWeight:700}}><TableCell r={r} tables={tables}/></td>
                    <td style={S.td}><Badge status={r.status}/></td>
                    <td style={S.td}><span style={{ fontSize:12, color:B.gray }}>{r.is_manual?'👤 Manual':'🌐 Online'}</span></td>
                    <td style={{...S.td, maxWidth:150}}>{r.notes?<span title={r.notes} style={{ fontSize:12, color:B.darkSoft, fontStyle:'italic', cursor:'help', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{r.notes}</span>:<span style={{ color:B.grayLight }}>—</span>}</td>
                    <td style={{...S.td, whiteSpace:'nowrap'}}><div style={{ display:'flex', gap:4 }}><QuickActions reservation={r} onSeated={onSeated} onEarlyFree={onEarlyFree} onEdit={r=>onEditReservation(r)}/>{!['no_show','cancelled','completed'].includes(r.status)&&<Btn size="sm" variant="danger" onClick={()=>updateReservation(r.id,{status:'no_show'}).then(onRefresh)} style={{ fontSize:10, padding:'4px 8px' }}>NS</Btn>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {todayRes.length === 0 && (
        <div style={{ ...S.card, textAlign:'center', padding:48, color:B.gray }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
          <p>No reservations today</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Reservations ────────────────────────────────────────────────────────

function ReservationsList({ reservations, tables, tags=[], onNew, onEdit, onDelete, onSeated, onEarlyFree }) {
  const [dateFilter,   setDateFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [view,         setView]         = useState('list')
  const today = new Date()
  const [calY, setCalY] = useState(today.getFullYear())
  const [calM, setCalM] = useState(today.getMonth())
  const [rangeStart,   setRangeStart]   = useState(null)
  const [rangeEnd,     setRangeEnd]     = useState(null)

  const filtered = reservations.filter(r => {
    if (dateFilter   && r.date!==dateFilter) return false
    if (statusFilter && r.status!==statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${r.first_name} ${r.last_name} ${r.email} ${r.phone}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const tName = (r) => tables.find(t=>t.id===r.table_id)?.name || (r.table_ids?.length ? r.table_ids.map(id=>tables.find(t=>t.id===id)?.name||'').filter(Boolean).join('+') : '—')

  const exportExcel = () => {
    const rows = [
      ['Date','Time','First Name','Last Name','Guests','Table','Status','Email','Phone','Notes','Source'],
      ...filtered.map(r=>[
        r.date, r.time, r.first_name, r.last_name||'', r.guests,
        tName(r), r.status, r.email||'', r.phone||'', r.notes||'',
        r.is_manual?'Manual':'Online'
      ])
    ]
    const csv = rows.map(row=>row.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reservations-${dateFilter||'all'}.csv`
    a.click()
  }

  const exportPDF = () => {
    const win = window.open('','_blank')
    const rows = filtered.map(r=>`
      <tr>
        <td>${r.date}</td>
        <td>${r.time||'—'}</td>
        <td>${r.first_name} ${r.last_name||''}</td>
        <td style="text-align:center">${r.guests}</td>
        <td>${tName(r)}</td>
        <td><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${r.status==='confirmed'?'#dbeafe':r.status==='seated'?'#dcfce7':r.status==='cancelled'?'#fee2e2':'#ffedd5'};color:${r.status==='confirmed'?'#1d4ed8':r.status==='seated'?'#16a34a':r.status==='cancelled'?'#dc2626':'#ea580c'}">${r.status}</span></td>
        <td style="font-size:11px;color:#666">${r.email||''}</td>
        <td style="font-size:11px;color:#666">${r.notes||''}</td>
      </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>Reservations — Underhuset</title>
    <style>
      body{font-family:'Helvetica Neue',sans-serif;padding:32px;color:#222}
      h1{font-size:22px;margin-bottom:4px;color:#3C4242}
      .sub{font-size:12px;color:#999;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#F99D54;color:#fff;padding:8px 10px;text-align:left;font-weight:700}
      td{padding:7px 10px;border-bottom:1px solid #eee}
      tr:nth-child(even) td{background:#fafafa}
      @media print{body{padding:16px}}
    </style></head><body>
    <h1>🍽 Underhuset — Reservations</h1>
    <div class="sub">Exported ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}${dateFilter?' · '+dateFilter:''} · ${filtered.length} reservation(s)</div>
    <table><thead><tr>
      <th>Date</th><th>Time</th><th>Guest</th><th>Pax</th><th>Table</th><th>Status</th><th>Email</th><th>Notes</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()</script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, fontWeight:600 }}>Reservations</h2>
        <div style={{ display:'flex', gap:8 }}>
          <Btn size="sm" variant={view==='list'?'primary':'secondary'} onClick={()=>setView('list')}>☰ List</Btn>
          <Btn size="sm" variant={view==='month'?'primary':'secondary'} onClick={()=>setView('month')}>📅 Month</Btn>
          <Btn size="sm" variant="secondary" onClick={exportExcel}>📊 Excel</Btn>
          <Btn size="sm" variant="secondary" onClick={exportPDF}>📄 PDF</Btn>
          <Btn onClick={onNew}>+ New manual reservation</Btn>
        </div>
      </div>
      {view === 'month' && (
        <>
        <div style={{ ...S.card, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <button onClick={()=>calM===0?(setCalY(calY-1),setCalM(11)):setCalM(calM-1)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:B.dark, padding:'2px 10px' }}>‹</button>
            <span style={{ fontFamily:'Playfair Display,serif', fontSize:18, fontWeight:600, color:B.dark }}>{MONTHS_EN[calM]} {calY}</span>
            <button onClick={()=>calM===11?(setCalY(calY+1),setCalM(0)):setCalM(calM+1)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:B.dark, padding:'2px 10px' }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:B.gray, padding:'4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array((new Date(calY,calM,1).getDay()+6)%7).fill(null).map((_,i)=><div key={'e'+i}/>)}
            {Array(new Date(calY,calM+1,0).getDate()).fill(null).map((_,i)=>{
              const day = i+1
              const iso = `${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayRes = reservations.filter(r=>r.date===iso&&r.status!=='cancelled')
              const guests = dayRes.reduce((s,r)=>s+r.guests,0)
              const isToday = iso===todayISO()
              const isSelected = dateFilter===iso
              return (
                <div key={day} onClick={()=>{
                  if (!rangeStart || (rangeStart && rangeEnd)) {
                    setRangeStart(iso); setRangeEnd(null)
                  } else {
                    if (iso < rangeStart) { setRangeEnd(rangeStart); setRangeStart(iso) }
                    else setRangeEnd(iso)
                  }
                }}
                  style={{ borderRadius:8, padding:'6px 4px', textAlign:'center', cursor:'pointer', minHeight:52,
                    background: (iso===rangeStart||iso===rangeEnd)?B.orange:(rangeStart&&rangeEnd&&iso>=rangeStart&&iso<=rangeEnd)?B.orangeLight:isToday?'#FEF3C7':dayRes.length>0?'#F0FDF4':'#FAFAFA',
                    border: `1px solid ${(iso===rangeStart||iso===rangeEnd)?B.orange:isToday?B.orange:'#E5E7EB'}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:(iso===rangeStart||iso===rangeEnd)?'#fff':B.dark }}>{day}</div>
                  {dayRes.length>0 && <div style={{ fontSize:10, color:(iso===rangeStart||iso===rangeEnd)?'#fff':'#16A34A', fontWeight:600 }}>{dayRes.length}r</div>}
                  {guests>0 && <div style={{ fontSize:9, color:(iso===rangeStart||iso===rangeEnd)?'rgba(255,255,255,.8)':B.gray }}>{guests}p</div>}
                </div>
              )
            })}
          </div>
          {/* Range indicator */}
          {rangeStart && (
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:B.dark }}>
                {rangeStart && !rangeEnd ? `From: ${rangeStart} — select end date` : `${rangeStart} → ${rangeEnd}`}
              </span>
              {rangeStart && rangeEnd && (
                <Btn size="sm" onClick={()=>{ setRangeStart(null); setRangeEnd(null) }}>✕ Clear range</Btn>
              )}
            </div>
          )}
        </div>

        {/* Reservations for selected range or month */}
        <div style={{ ...S.card, padding:0, overflow:'auto', marginTop:16 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#FAFAFA' }}>
              {['Code','Date','Time','Name','Guests','Table','Status','Source','Notes'].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {reservations.filter(r=>{
                const monthStr = `${calY}-${String(calM+1).padStart(2,'0')}`
                if (rangeStart && rangeEnd) return r.date >= rangeStart && r.date <= rangeEnd
                return r.date.startsWith(monthStr)
              }).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).map(r=>(
                <tr key={r.id} onClick={()=>onEdit(r)} style={{ cursor:'pointer', borderTop:`1px solid ${B.grayLight}` }}
                  onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{...S.td,fontSize:15,fontWeight:600}}>{fmtDate(r.date)}</td>
                  <td style={{...S.td,fontSize:15,fontWeight:700}}>{fmtTime(r.time)}</td>
                  <td style={S.td}>
                    <div style={{ fontWeight:700, fontSize:15, cursor:'pointer', color:B.dark }} onClick={()=>onEdit(r)}>{r.first_name} {r.last_name||''}</div>
                    {r.merged_with && <div style={{ fontSize:11, color:'#7C3AED', fontWeight:700 }}>🔗 +{r.merged_with}</div>}
                    <TagBadges tagIds={r.tag_ids} tags={tags}/>
                  </td>
                  <td style={{...S.td,fontSize:15,fontWeight:700}}>👥 {r.guests}</td>
                  <td style={{...S.td,fontSize:15,fontWeight:700}}><TableCell r={r} tables={tables}/></td>
                  <td style={S.td}><Badge status={r.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'auto auto auto 1fr', gap:12, marginBottom:20, alignItems:'end' }}>
        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
            style={{...S.input, width:'auto'}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Status</label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            style={{...S.input, width:'auto', cursor:'pointer'}}>
            <option value="">All</option>
            {Object.entries(STATUS_COLOR).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end' }}>
          {(dateFilter||statusFilter) && <Btn size="sm" variant="ghost" onClick={()=>{setDateFilter('');setStatusFilter('')}}>✕ Clear</Btn>}
        </div>
        <div>
          <label style={S.label}>Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email, phone…"
            style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
      </div>
      {view!=='month' && <div style={{ ...S.card, padding:0, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
          <thead>
            <tr>{['Code','Date','Time','Name','Guests','Table','Status','Source','Notes',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={9} style={{...S.td,textAlign:'center',color:B.gray,padding:40}}>No results</td></tr>}
            {view!=='month' && filtered.map(r=>(
              <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{...S.td,fontWeight:700,fontSize:12,color:B.gray}}>{r.reservation_code||'—'}</td>
                <td style={{...S.td,fontWeight:600,fontSize:15}}>{fmtDate(r.date)}</td>
                <td style={{...S.td,fontWeight:700,fontSize:15}}>{fmtTime(r.time)}</td>
                <td style={S.td}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{r.first_name} {r.last_name}</div>
                  <div style={{ fontSize:11, color:B.gray }}>{r.email}</div>
                  {r.merged_with && <div style={{ fontSize:11, color:'#7C3AED', fontWeight:700 }}>🔗 +{r.merged_with}</div>}
                  <TagBadges tagIds={r.tag_ids} tags={tags}/>
                </td>
                <td style={{...S.td,fontSize:15,fontWeight:700}}>👥 {r.guests}</td>
                <td style={{...S.td,fontSize:15,fontWeight:700}}><TableCell r={r} tables={tables}/></td>
                <td style={S.td}><Badge status={r.status}/></td>
                <td style={S.td}><span style={{ fontSize:11, color:B.gray }}>{r.is_manual?'👤 Manual':'🌐 Online'}</span></td>
                <td style={{...S.td, maxWidth:180}}>
                  {r.notes?<span title={r.notes} style={{ fontSize:12, color:B.darkSoft, fontStyle:'italic', cursor:'help', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{r.notes}</span>:<span style={{ color:B.grayLight }}>—</span>}
                </td>
                <td style={{...S.td, whiteSpace:'nowrap'}}>
                  <div style={{ display:'flex', gap:6 }}>
                    <QuickActions reservation={r} onSeated={onSeated} onEarlyFree={onEarlyFree} onEdit={onEdit}/>
                    <Btn size="sm" variant="danger" onClick={()=>onDelete(r)}>×</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      <p style={{ fontSize:12, color:B.gray, marginTop:10 }}>{filtered.length} reservation(s)</p>
    </div>
  )
}

// ─── Tab: Waitlist ────────────────────────────────────────────────────────────

function WaitlistTab({ waitlist, onRefresh }) {
  const [confirm, setConfirm] = useState(null)

  const WSTATUS = {
    waiting:   { bg:B.yellowLight, text:B.yellow,  label:'Waiting'   },
    notified:  { bg:B.blueLight,   text:B.blue,    label:'Notified'  },
    confirmed: { bg:B.greenLight,  text:B.green,   label:'Confirmed' },
    expired:   { bg:B.grayLight,   text:B.gray,    label:'Expired'   },
  }

  const notify = async (e) => {
    await updateWaitlistEntry(e.id, { status:'notified', notified_at: new Date().toISOString() })
    await sendEmail('waitlist_spot', { entry: e })
    onRefresh()
  }

  const remove = async (e) => {
    await deleteWaitlistEntry(e.id)
    setConfirm(null)
    onRefresh()
  }

  return (
    <div>
      <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, marginBottom:20, fontWeight:600 }}>Waitlist</h2>
      <div style={{ ...S.card, padding:0, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead><tr>{['Date','Time','Name','Email','Status','Added',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {waitlist.length===0&&<tr><td colSpan={7} style={{...S.td,textAlign:'center',color:B.gray,padding:40}}>No one on the waitlist</td></tr>}
            {waitlist.map(e=>{
              const c = WSTATUS[e.status]||WSTATUS.waiting
              return (
                <tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background=B.orangePale}
                  onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                  <td style={{...S.td,fontWeight:600}}>{fmtDate(e.date)}</td>
                  <td style={{...S.td,fontWeight:700}}>{fmtTime(e.time)}</td>
                  <td style={S.td}>{e.first_name} {e.last_name}</td>
                  <td style={{...S.td,fontSize:12,color:B.gray}}>{e.email}</td>
                  <td style={S.td}><span style={{ background:c.bg, color:c.text, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{c.label}</span></td>
                  <td style={{...S.td,fontSize:12,color:B.gray}}>{new Date(e.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</td>
                  <td style={{...S.td,whiteSpace:'nowrap'}}>
                    <div style={{ display:'flex', gap:6 }}>
                      {e.status==='waiting'&&<Btn size="sm" variant="purple" onClick={()=>notify(e)}>Notify</Btn>}
                      <Btn size="sm" variant="danger" onClick={()=>setConfirm(e)}>×</Btn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {confirm&&<Confirm message={`Remove ${confirm.first_name} ${confirm.last_name} from the waitlist?`} onYes={()=>remove(confirm)} onNo={()=>setConfirm(null)}/>}
    </div>
  )
}

// ─── Tab: Tables ──────────────────────────────────────────────────────────────

function TablesManager({ tables, groups, onRefresh }) {
  const [form,    setForm]    = useState({ name:'', capacity:4, zone:'interior', is_blocked:false })
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const upd = (k,v) => setForm(f=>({...f,[k]:v}))

  // Groups state
  const [gName,    setGName]    = useState('')
  const [gTables,  setGTables]  = useState([])
  const [gEditing, setGEditing] = useState(null)
  const [gConfirm, setGConfirm] = useState(null)
  const [gSaving,  setGSaving]  = useState(false)

  const saveTable = async () => {
    setSaving(true)
    try {
      if (editing) await updateTable(editing.id, { name:form.name, capacity:parseInt(form.capacity), zone:form.zone, is_blocked:form.is_blocked })
      else await createTable({ name:form.name, capacity:parseInt(form.capacity), zone:form.zone, is_blocked:form.is_blocked, is_active:true, position:tables.length+1 })
      setForm({ name:'', capacity:4, zone:'interior', is_blocked:false })
      setEditing(null); onRefresh()
    } finally { setSaving(false) }
  }

  const saveGroup = async () => {
    setGSaving(true)
    try {
      const capacity = gTables.reduce((s,id)=>{ const t=tables.find(t=>t.id===id); return s+(t?.capacity||0) },0)
      if (gEditing) await updateTableGroup(gEditing.id, { name:gName, table_ids:gTables, capacity })
      else await createTableGroup({ name:gName, table_ids:gTables, capacity, is_active:true, position:(groups||[]).length+1 })
      setGName(''); setGTables([]); setGEditing(null); onRefresh()
    } finally { setGSaving(false) }
  }

  const toggleGTable = (id) => setGTables(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])

  const interior = tables.filter(t=>t.zone==='interior')
  const exterior = tables.filter(t=>t.zone==='exterior')

  const TableRow = ({ t }) => (
    <tr onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <td style={S.td}><span style={{ fontWeight:600, color:t.is_active?B.dark:B.gray, textDecoration:t.is_active?'none':'line-through' }}>{t.name}</span></td>
      <td style={S.td}>{t.capacity}p</td>
      <td style={S.td}>
        {t.is_blocked&&<span style={{ background:B.redLight,color:B.red,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>Blocked</span>}
        {!t.is_active&&!t.is_blocked&&<span style={{ background:B.grayLight,color:B.gray,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>Inactive</span>}
        {t.is_active&&!t.is_blocked&&<span style={{ background:B.greenLight,color:B.green,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>Active</span>}
      </td>
      <td style={{...S.td,whiteSpace:'nowrap'}}>
        <div style={{ display:'flex', gap:6 }}>
          <Btn size="sm" variant="secondary" onClick={()=>{ setEditing(t); setForm({ name:t.name, capacity:t.capacity, zone:t.zone, is_blocked:t.is_blocked }) }}>Edit</Btn>
          <Btn size="sm" variant={t.is_blocked?'success':'secondary'} onClick={async()=>{ await updateTable(t.id,{is_blocked:!t.is_blocked}); onRefresh() }}>{t.is_blocked?'Unblock':'Block'}</Btn>
          <Btn size="sm" variant="ghost" onClick={async()=>{ await updateTable(t.id,{is_active:!t.is_active}); onRefresh() }}>{t.is_active?'Deactivate':'Activate'}</Btn>
          <Btn size="sm" variant="danger" onClick={()=>setConfirm(t)}>×</Btn>
        </div>
      </td>
    </tr>
  )

  return (
    <div>
      <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, marginBottom:20, fontWeight:600 }}>Tables</h2>

      <div style={{ ...S.card, marginBottom:24 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:B.dark, marginBottom:16 }}>{editing?`✏️ Editing: ${editing.name}`:'+ Add new table'}</h3>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:12, alignItems:'end' }}>
          <Input label="Name" value={form.name} onChange={v=>upd('name',v)} placeholder="Table 15"/>
          <div>
            <label style={S.label}>Capacity</label>
            <input type="number" min={1} max={20} value={form.capacity} onChange={e=>upd('capacity',e.target.value)}
              style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
          </div>
          <Select label="Zone" value={form.zone} onChange={v=>upd('zone',v)} options={[{value:'interior',label:'Interior'},{value:'exterior',label:'Exterior'}]}/>
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={saveTable} disabled={!form.name||saving}>{saving?'…':editing?'Save':'Add'}</Btn>
            {editing&&<Btn variant="ghost" onClick={()=>{setEditing(null);setForm({name:'',capacity:4,zone:'interior',is_blocked:false})}}>✕</Btn>}
          </div>
        </div>
        <div style={{ marginTop:16 }}>
          <Toggle checked={form.is_blocked} onChange={v=>upd('is_blocked',v)} label="Mark as blocked (does not count towards capacity)"/>
        </div>
      </div>

      {[['Interior',interior],['Exterior',exterior]].map(([label,list])=>list.length>0&&(
        <div key={label} style={{ marginBottom:24 }}>
          <h3 style={{ fontSize:12, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:B.gray, marginBottom:10 }}>{label}</h3>
          <div style={{ ...S.card, padding:0, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Table','Capacity','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{list.map(t=><TableRow key={t.id} t={t}/>)}</tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Table Groups ── */}
      <div style={{ marginTop:32, borderTop:`2px solid ${B.grayLight}`, paddingTop:32 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:20, color:B.dark, marginBottom:16, fontWeight:600 }}>🔗 Table Groups</h2>
        <p style={{ fontSize:13, color:B.gray, marginBottom:20 }}>Combine tables for large party reservations. Groups can be assigned instead of individual tables.</p>

        <div style={{ ...S.card, marginBottom:24 }}>
          <h3 style={{ fontSize:14, fontWeight:700, color:B.dark, marginBottom:16 }}>
            {gEditing?`✏️ Editing: ${gEditing.name}`:'+ Create new group'}
          </h3>
          <div style={{ display:'grid', gap:16 }}>
            <Input label="Group name" value={gName} onChange={setGName} placeholder="e.g. Large party — 6+11+13"/>
            <div>
              <label style={S.label}>Select tables ({gTables.length} selected)</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6 }}>
                {tables.filter(t=>t.is_active).map(t=>(
                  <button key={t.id} onClick={()=>toggleGTable(t.id)} style={{
                    padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600,
                    border:`2px solid ${gTables.includes(t.id)?B.orange:B.grayLight}`,
                    background:gTables.includes(t.id)?B.orange:'#fff',
                    color:gTables.includes(t.id)?'#fff':B.dark, cursor:'pointer', transition:'all .15s',
                  }}>{t.name} ({t.capacity}p)</button>
                ))}
              </div>
              {gTables.length >= 2 && (
                <div style={{ marginTop:10, padding:10, background:B.greenLight, borderRadius:8, fontSize:13, color:B.green, fontWeight:600 }}>
                  ✓ Total capacity: {gTables.reduce((s,id)=>{ const t=tables.find(t=>t.id===id); return s+(t?.capacity||0) },0)} guests
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <Btn onClick={saveGroup} disabled={!gName||gTables.length<2||gSaving}>
                {gSaving?'…':gEditing?'Save group':'Create group'}
              </Btn>
              {gEditing&&<Btn variant="ghost" onClick={()=>{setGEditing(null);setGName('');setGTables([])}}>✕ Cancel</Btn>}
            </div>
          </div>
        </div>

        {(groups||[]).length > 0 && (
          <div style={{ ...S.card, padding:0, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Group','Tables','Capacity','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {(groups||[]).map(g=>(
                  <tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...S.td,fontWeight:600}}>{g.name}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {(g.table_ids||[]).map(id=>{ const t=tables.find(t=>t.id===id); return t?<span key={id} style={{ background:B.blueLight,color:B.blue,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600 }}>{t.name}</span>:null })}
                      </div>
                    </td>
                    <td style={S.td}>{g.capacity}p</td>
                    <td style={S.td}>{g.is_active?<span style={{ background:B.greenLight,color:B.green,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>Active</span>:<span style={{ background:B.grayLight,color:B.gray,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>Inactive</span>}</td>
                    <td style={{...S.td,whiteSpace:'nowrap'}}>
                      <div style={{ display:'flex', gap:6 }}>
                        <Btn size="sm" variant="secondary" onClick={()=>{ setGEditing(g); setGName(g.name); setGTables([...(g.table_ids||[])]) }}>Edit</Btn>
                        <Btn size="sm" variant="ghost" onClick={async()=>{ await updateTableGroup(g.id,{is_active:!g.is_active}); onRefresh() }}>{g.is_active?'Deactivate':'Activate'}</Btn>
                        <Btn size="sm" variant="danger" onClick={()=>setGConfirm(g)}>×</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm&&<Confirm message={`Permanently delete table "${confirm.name}"?`} onYes={async()=>{ await deleteTable(confirm.id); setConfirm(null); onRefresh() }} onNo={()=>setConfirm(null)}/>}
      {gConfirm&&<Confirm message={`Permanently delete group "${gConfirm.name}"?`} onYes={async()=>{ await deleteTableGroup(gConfirm.id); setGConfirm(null); onRefresh() }} onNo={()=>setGConfirm(null)}/>}
    </div>
  )
}

// ─── Tab: Breakfast ───────────────────────────────────────────────────────────

function BreakfastTab({ breakfast, settings, onRefresh }) {
  const [dateFilter,  setDateFilter]  = useState('')
  const [hotelFilter, setHotelFilter] = useState('')
  const [newModal,    setNewModal]    = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [confirm,     setConfirm]     = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [staffDay,    setStaffDay]    = useState('')
  const [staffSaving, setStaffSaving] = useState(false)

  const applyStaffToDay = async () => {
    if (!staffDay || !dateFilter) return
    setStaffSaving(true)
    try {
      const dayResos = breakfast.filter(r => r.date === dateFilter && r.status !== 'cancelled')
      await Promise.all(dayResos.map(r => updateBreakfastReservation(r.id, { staff_names: staffDay })))
      onRefresh()
    } finally { setStaffSaving(false) }
  }

  let hotels = []
  try { hotels = JSON.parse(settings.hotels||'[]') } catch {}

  const filtered = breakfast.filter(r => {
    if (dateFilter  && r.date  !== dateFilter)  return false
    if (hotelFilter && r.hotel !== hotelFilter) return false
    return true
  })

  const totalGuests = filtered.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+r.guests,0)

  // Stats by hotel
  const byHotel = {}
  for (const r of filtered.filter(r=>r.status!=='cancelled')) {
    byHotel[r.hotel] = (byHotel[r.hotel]||0) + r.guests
  }

  const save = async (f) => {
    setSaving(true)
    try {
      if (editModal) await updateBreakfastReservation(editModal.id, f)
      else await createBreakfastReservation(f)
      setNewModal(false); setEditModal(null); onRefresh()
    } finally { setSaving(false) }
  }

  const exportCSV = () => {
    const rows = [
      ['Date','Hotel','Guests','Contact','Email','Phone','Notes','Staff','Status'],
      ...filtered.map(r=>[r.date, r.hotel, r.guests, r.contact_name, r.contact_email||'', r.contact_phone||'', r.notes||'', r.staff_names||'', r.status])
    ]
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `breakfast-${dateFilter||'all'}-${hotelFilter||'all'}.csv`
    a.click()
  }

  const BFORM_EMPTY = { date:'', guests:1, hotel:'', contact_name:'', contact_email:'', contact_phone:'', notes:'', staff_names:'', status:'confirmed' }

  const BreakfastForm = ({ initial={}, onSave, onCancel }) => {
    const [f, setF] = useState({ ...BFORM_EMPTY, ...initial })
    const upd = (k,v) => setF(p=>({...p,[k]:v}))
    const maxG = parseInt(settings.breakfast_max_guests||44)
    const valid = f.date && f.guests && f.hotel && f.contact_name

    return (
      <div style={{ display:'grid', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={S.label}>Date *</label>
            <input type="date" value={f.date} onChange={e=>upd('date',e.target.value)}
              style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
          </div>
          <div>
            <label style={S.label}>Guests *</label>
            <input type="number" min={1} max={maxG} value={f.guests} onChange={e=>upd('guests',parseInt(e.target.value)||1)}
              style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
          </div>
        </div>
        <div>
          <label style={S.label}>Property *</label>
          <select value={f.hotel} onChange={e=>upd('hotel',e.target.value)}
            style={{...S.input, cursor:'pointer', appearance:'auto'}}
            onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}>
            <option value="">Select…</option>
            <option value="None">None</option>
            <option value="Sakrisøy Rorbuer">Sakrisøy Rorbuer</option>
            {hotels.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Contact name *</label>
          <input value={f.contact_name} onChange={e=>upd('contact_name',e.target.value)}
            style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Email</label>
          <input type="email" value={f.contact_email||''} onChange={e=>upd('contact_email',e.target.value)}
            style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Phone</label>
          <input type="tel" value={f.contact_phone||''} onChange={e=>upd('contact_phone',e.target.value)}
            style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Notes</label>
          <textarea value={f.notes||''} onChange={e=>upd('notes',e.target.value)} rows={2}
            style={{...S.input, resize:'vertical'}}
            onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Staff on duty</label>
          <input placeholder="e.g. Maria, Sofia" value={f.staff_names||''} onChange={e=>upd('staff_names',e.target.value)} style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <Btn variant="secondary" onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={()=>onSave(f)} disabled={!valid||saving} style={{ flex:2 }}>
            {saving?'Saving…':'✓ Save'}
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, fontWeight:600 }}>🍳 Breakfast & Hotels</h2>
        <div style={{ display:'flex', gap:8 }}>
          <Btn size="sm" variant="secondary" onClick={()=>setDateFilter(todayISO())} style={{background: dateFilter===todayISO()?'#F99D54':'', color: dateFilter===todayISO()?'#fff':''}}>📅 Today</Btn>
          <Btn size="sm" variant="secondary" onClick={exportCSV}>⬇ Export CSV</Btn>
          <Btn size="sm" onClick={()=>setNewModal(true)}>+ New reservation</Btn>
        </div>
      </div>

      {/* Hotel links */}
      <div style={{ ...S.card, marginBottom:20, background:B.blueLight }}>
        <div style={{ fontSize:12, fontWeight:700, color:B.blue, marginBottom:10, letterSpacing:'.05em', textTransform:'uppercase' }}>🔗 Hotel booking links</div>
        <div style={{ display:'grid', gap:8 }}>
          {[
            { label:'Ingrid',    path:'/ingrid' },
            { label:'Marta',     path:'/marta'  },
            { label:'Sakrisøy',  path:'/sakrisoy' },
            { label:'General',   path:'/page' },
          ].map(({ label, path })=>(
            <div key={path} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:B.blue, fontWeight:600, minWidth:100 }}>{label}</span>
              <code style={{ fontSize:12, color:B.dark, background:'#fff', padding:'4px 10px', borderRadius:6, flex:1, minWidth:160 }}>
                {window.location.origin}{path}
              </code>
              <Btn size="sm" onClick={()=>navigator.clipboard.writeText(window.location.origin+path)}>Copy</Btn>
            </div>
          ))}
        </div>
      </div>

      {/* Stats by hotel */}
      {Object.keys(byHotel).length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:20 }}>
          {Object.entries(byHotel).map(([hotel, guests])=>(
            <div key={hotel} style={{ ...S.card, padding:'14px 16px' }}>
              <div style={{ fontSize:11, color:B.gray, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{hotel}</div>
              <div style={{ fontSize:22, fontWeight:700, color:B.blue, fontFamily:'Playfair Display,serif' }}>{guests}</div>
              <div style={{ fontSize:11, color:B.gray }}>guests</div>
            </div>
          ))}
          <div style={{ ...S.card, padding:'14px 16px', border:`2px solid ${B.orange}` }}>
            <div style={{ fontSize:11, color:B.gray, marginBottom:4 }}>Total</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.orange, fontFamily:'Playfair Display,serif' }}>{totalGuests}</div>
            <div style={{ fontSize:11, color:B.gray }}>guests</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'grid', gridTemplateColumns:'auto auto auto', gap:12, marginBottom:16, alignItems:'end' }}>
        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
            style={{...S.input, width:'auto'}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
        </div>
        <div>
          <label style={S.label}>Property</label>
          <select value={hotelFilter} onChange={e=>setHotelFilter(e.target.value)}
            style={{...S.input, width:'auto', cursor:'pointer'}}>
            <option value="">All</option>
            {hotels.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end' }}>
          {(dateFilter||hotelFilter) && <Btn size="sm" variant="ghost" onClick={()=>{setDateFilter('');setHotelFilter('')}}>✕ Clear</Btn>}
        </div>
      </div>

      {/* Staff on duty */}
      {dateFilter && (
        <div style={{ background:'#FEF4EB', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#3C4242' }}>👤 Staff on duty — {dateFilter}</span>
          <input placeholder="e.g. Maria, Sofia" value={staffDay} onChange={e=>setStaffDay(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'2px solid #F99D54', fontSize:13, outline:'none', minWidth:180 }}/>
          <Btn size="sm" onClick={applyStaffToDay} disabled={staffSaving || staffDay===''}>{staffSaving ? 'Saving…' : 'Apply to all today'}</Btn>
        </div>
      )}

      {/* Table */}
      <div style={{ ...S.card, padding:0, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
          <thead>
            <tr>{['Date','Property','Guests','Contact','Email','Staff','Notes','Status',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={8} style={{...S.td,textAlign:'center',color:B.gray,padding:40}}>No results</td></tr>}
            {filtered.map(r=>(
              <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background=B.orangePale}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{...S.td,fontWeight:600}}>{fmtDate(r.date)}</td>
                <td style={S.td}><span style={{ background:B.blueLight,color:B.blue,padding:'2px 8px',borderRadius:6,fontSize:12,fontWeight:600 }}>{r.hotel}</span></td>
                <td style={{...S.td,fontWeight:700}}>👥 {r.guests}</td>
                <td style={S.td}>{r.contact_name}</td>
                <td style={{...S.td,fontSize:12,color:B.gray}}>{r.contact_email}</td>
                <td style={S.td}>{r.staff_names||<span style={{ color:B.grayLight }}>—</span>}</td>
                <td style={{...S.td,maxWidth:150}}>
                  {r.notes?<span title={r.notes} style={{ fontSize:12,color:B.darkSoft,fontStyle:'italic',cursor:'help',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:140 }}>{r.notes}</span>:<span style={{ color:B.grayLight }}>—</span>}
                </td>
                <td style={S.td}>
                  <span onClick={async()=>{ const next=r.status==='confirmed'?'seated':r.status==='seated'?'cancelled':'confirmed'; await updateBreakfastReservation(r.id,{status:next}); onRefresh() }} style={{ background:r.status==='cancelled'?B.redLight:r.status==='seated'?'#e8f5e9':'#fff3e0', color:r.status==='cancelled'?B.red:r.status==='seated'?'#2e7d32':'#e65100', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', userSelect:'none', title:'Click to change status' }}>
                    {r.status==='cancelled'?'❌ Cancelled':r.status==='seated'?'✅ Seated':'🟡 Confirmed'}
                  </span>
                </td>
                <td style={{...S.td,whiteSpace:'nowrap'}}>
                  <div style={{ display:'flex', gap:6 }}>
                    <Btn size="sm" variant="secondary" onClick={()=>setEditModal(r)}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={()=>setConfirm(r)}>×</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:12, color:B.gray, marginTop:10 }}>{filtered.length} reservation(s) · {totalGuests} guests total</p>

      {newModal  && <Modal title="New breakfast reservation" onClose={()=>setNewModal(false)}><BreakfastForm onSave={save} onCancel={()=>setNewModal(false)}/></Modal>}
      {editModal && <Modal title="Edit breakfast reservation" onClose={()=>setEditModal(null)}><BreakfastForm initial={editModal} onSave={save} onCancel={()=>setEditModal(null)}/></Modal>}
      {confirm   && <Confirm message={`Delete breakfast reservation for ${confirm.contact_name} (${confirm.hotel}, ${fmtDate(confirm.date)})?`}
        onYes={async()=>{ await deleteBreakfastReservation(confirm.id); setConfirm(null); onRefresh() }}
        onNo={()=>setConfirm(null)}/>}
    </div>
  )
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────


const CAT_COLORS = {
  Admin:   '#F59E0B',
  Occasion:'#3B82F6',
  Group:   '#10B981',
  Party:   '#7C3AED',
}
const CATEGORIES = ['Admin', 'Occasion', 'Group', 'Party']
const CAT_EMOJI = { Admin:'📋', Occasion:'🎉', Group:'👥', Party:'🎈' }

function TagManager({ tags, onTagsChange }) {
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('Admin')
  const [newEmoji, setNewEmoji] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createTag({ name: newName.trim(), category: newCat, color: CAT_COLORS[newCat], emoji: newEmoji||null })
      setNewName(''); setNewEmoji('')
      onTagsChange()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await deleteTag(id)
    onTagsChange()
  }

  return (
    <div style={{ display:'grid', gap:20 }}>
      <div style={{ background:B.orangePale, borderRadius:12, padding:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:B.dark, marginBottom:12 }}>Add new tag</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, alignItems:'end' }}>
          <div>
            <label style={S.label}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Invoice sent"
              style={S.input} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}
              onKeyDown={e=>e.key==='Enter'&&handleAdd()}/>
          </div>
          <div>
            <label style={S.label}>Category</label>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={{...S.input, cursor:'pointer', appearance:'auto'}}>
              {CATEGORIES.map(c=><option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Emoji</label>
            <input value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} placeholder="🎂"
              style={{...S.input, width:60, textAlign:'center'}}/>
          </div>
          <Btn onClick={handleAdd} disabled={saving||!newName.trim()}>+ Add</Btn>
        </div>
      </div>
      {CATEGORIES.map(cat => {
        const catTags = tags.filter(t=>t.category===cat)
        const color = CAT_COLORS[cat]
        return (
          <div key={cat}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:color }}/>
              <span style={{ fontSize:12, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.06em' }}>{CAT_EMOJI[cat]} {cat}</span>
            </div>
            {catTags.length === 0 && <div style={{ fontSize:12, color:B.grayLight }}>No tags yet</div>}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {catTags.map(tag => (
                <div key={tag.id} style={{ display:'flex', alignItems:'center', gap:6, background:color+'22', border:'2px solid '+color, borderRadius:20, padding:'4px 12px' }}>
                  {tag.emoji && <span>{tag.emoji}</span>}
                  <span style={{ fontSize:13, fontWeight:600, color }}>{tag.name}</span>
                  <button onClick={()=>handleDelete(tag.id)} style={{ background:'none', border:'none', cursor:'pointer', color, fontSize:14, lineHeight:1, opacity:0.7, padding:'0 2px' }}>x</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TagSelector({ tags, selectedIds=[], onChange }) {
  const [openCat, setOpenCat] = useState(null)

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x=>x!==id) : [...selectedIds, id]
    onChange(next)
  }

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {CATEGORIES.map(cat => {
        const catTags = tags.filter(t=>t.category===cat)
        if (catTags.length===0) return null
        const color = CAT_COLORS[cat]
        const selected = catTags.filter(t=>selectedIds.includes(t.id))
        const isOpen = openCat===cat
        return (
          <div key={cat} style={{ position:'relative' }}>
            <button onClick={()=>setOpenCat(isOpen?null:cat)}
              style={{ display:'flex', alignItems:'center', gap:6, background:selected.length>0?color:color+'22', border:'2px solid '+color, borderRadius:20, padding:'6px 14px', cursor:'pointer', transition:'all .15s' }}>
              <span style={{ fontSize:12 }}>{CAT_EMOJI[cat]}</span>
              <span style={{ fontSize:12, fontWeight:700, color:selected.length>0?'#fff':color }}>{cat}</span>
              {selected.length>0 && <span style={{ background:'rgba(255,255,255,.3)', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:11, fontWeight:700 }}>{selected.length}</span>}
            </button>
            {isOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, marginTop:4, background:'#fff', borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,.15)', border:'1px solid #E2E6E6', zIndex:50, minWidth:180, padding:8 }}>
                {catTags.map(tag=>{
                  const sel = selectedIds.includes(tag.id)
                  return (
                    <div key={tag.id} onClick={()=>toggle(tag.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:sel?color+'22':'transparent' }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:color, opacity:sel?1:0.3 }}/>
                      {tag.emoji && <span style={{ fontSize:12 }}>{tag.emoji}</span>}
                      <span style={{ fontSize:13, fontWeight:sel?700:400, color:sel?color:B.dark }}>{tag.name}</span>
                      {sel && <span style={{ marginLeft:'auto', color }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {tags.length===0 && <span style={{ fontSize:12, color:B.gray }}>No tags — add them in Settings</span>}
    </div>
  )
}

function TagBadges({ tagIds, tags }) {
  const [openCat, setOpenCat] = useState(null)
  if (!tagIds) return null
  let ids = []
  try { ids = JSON.parse(tagIds) } catch { return null }
  if (!ids.length) return null

  const bycat = CATEGORIES.map(cat => ({
    cat, color: CAT_COLORS[cat], emoji: CAT_EMOJI[cat],
    tagList: ids.map(id=>tags.find(t=>t.id===id)).filter(t=>t&&t.category===cat)
  })).filter(x=>x.tagList.length>0)

  if (!bycat.length) return null

  return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>
      {bycat.map(({cat,color,emoji,tagList})=>(
        <div key={cat} style={{ position:'relative' }}>
          <div onClick={e=>{ e.stopPropagation(); setOpenCat(openCat===cat?null:cat) }}
            style={{ display:'flex', alignItems:'center', gap:3, background:color+'22', border:'1px solid '+color, borderRadius:12, padding:'2px 7px', cursor:'pointer' }}>
            <span style={{ fontSize:10 }}>{emoji}</span>
            <span style={{ fontSize:10, fontWeight:700, color }}>{tagList.length}</span>
          </div>
          {openCat===cat && (
            <div style={{ position:'absolute', top:'100%', left:0, marginTop:3, background:'#fff', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,.15)', border:'1px solid #E2E6E6', zIndex:999, minWidth:160, padding:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', padding:'4px 8px', marginBottom:2 }}>{emoji} {cat}</div>
              {tagList.map(tag=>(
                <div key={tag.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6 }}>
                  {tag.emoji && <span style={{ fontSize:11 }}>{tag.emoji}</span>}
                  <span style={{ fontSize:12, color:B.dark }}>{tag.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SettingsTab({ settings, onSave, tags=[], onTagsChange }) {
  const [s,     setS]     = useState(settings)
  const [saved, setSaved] = useState(false)
  useEffect(()=>setS(settings),[settings])
  const upd = (k,v) => setS(p=>({...p,[k]:v}))

  let hours = {}
  try { hours = JSON.parse(s.opening_hours||'{}') } catch {}
  const updateHours = (day, field, val) => {
    const h = { ...hours, [day]: { ...(hours[day]||{}), [field]: val } }
    upd('opening_hours', JSON.stringify(h))
  }

  const save = async () => {
    for (const [k,v] of Object.entries(s)) await setSetting(k, String(v))
    setSaved(true); setTimeout(()=>setSaved(false),2000)
    onSave(s)
  }

  return (
    <div>
      <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:B.dark, marginBottom:20, fontWeight:600 }}>Settings</h2>
      <div style={{ display:'grid', gap:20 }}>

        {/* Opening hours */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🕐 Opening Hours</h3>
          <div style={{ display:'grid', gap:12 }}>
            {DAY_KEYS.map((key,i)=>{
              const d = hours[key] || { open:true, lunch_enabled:true, dinner_enabled:true, lunch_from:'12:00', lunch_to:'14:30', dinner_from:'17:00', dinner_to:'21:00' }
              const timeOpts = Array.from({length:(23-10)*2+1},(_,j)=>{ const h=10+Math.floor(j/2),m=j%2?'30':'00'; return `${String(h).padStart(2,'0')}:${m}` })
              const TimeSelect = ({ value, onChange }) => (
                <select value={value} onChange={e=>onChange(e.target.value)}
                  style={{...S.input,width:'auto',padding:'6px 10px',cursor:'pointer'}}
                  onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}>
                  {timeOpts.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              )
              return (
                <div key={key} style={{ padding:'12px 0', borderBottom:`1px solid ${B.grayLight}` }}>
                  <Toggle checked={!!d.open} onChange={v=>updateHours(key,'open',v)} label={DAY_NAMES[i]}/>
                  {d.open && (
                    <div style={{ marginTop:10, display:'grid', gap:8, paddingLeft:56 }}>
                      {/* Lunch row */}
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <Toggle checked={d.lunch_enabled!==false} onChange={v=>updateHours(key,'lunch_enabled',v)} label="☀️ Lunch"/>
                        {d.lunch_enabled!==false && <>
                          <TimeSelect value={d.lunch_from||'12:00'} onChange={v=>updateHours(key,'lunch_from',v)}/>
                          <span style={{ fontSize:12, color:B.gray }}>to</span>
                          <TimeSelect value={d.lunch_to||'14:30'} onChange={v=>updateHours(key,'lunch_to',v)}/>
                        </>}
                      </div>
                      {/* Dinner row */}
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <Toggle checked={d.dinner_enabled!==false} onChange={v=>updateHours(key,'dinner_enabled',v)} label="🌙 Dinner"/>
                        {d.dinner_enabled!==false && <>
                          <TimeSelect value={d.dinner_from||'17:00'} onChange={v=>updateHours(key,'dinner_from',v)}/>
                          <span style={{ fontSize:12, color:B.gray }}>to</span>
                          <TimeSelect value={d.dinner_to||'21:00'} onChange={v=>updateHours(key,'dinner_to',v)}/>
                        </>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Closed periods */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🚫 Closed Periods</h3>
          <ClosedPeriods settings={{ closed_periods: s.closed_periods||'[]' }} onUpdate={(_,v)=>upd('closed_periods',v)}/>
        </div>

        {/* Breakfast days */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🍳 Breakfast Days</h3>
          <div style={{ display:'grid', gap:12 }}>
            {DAY_KEYS.map((key,i)=>{
              let bdays = {}
              try { bdays = JSON.parse(s.breakfast_days||'{}') } catch {}
              const d = bdays[key] !== undefined ? bdays[key] : true
              return (
                <div key={key} style={{ padding:'8px 0', borderBottom:`1px solid ${B.grayLight}` }}>
                  <Toggle checked={!!d} onChange={v=>{
                    let cur = {}; try { cur = JSON.parse(s.breakfast_days||'{}') } catch {}
                    cur[key] = v
                    upd('breakfast_days', JSON.stringify(cur))
                  }} label={DAY_NAMES[i]}/>
                </div>
              )
            })}
          </div>
        </div>

        {/* Breakfast closed periods */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🚫 Breakfast Closed Periods</h3>
          <ClosedPeriods settings={{ closed_periods: s.breakfast_closed_periods||'[]' }} onUpdate={(_,v)=>upd('breakfast_closed_periods',v)}/>
        </div>

        {/* Emails */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>📧 Automatic Emails</h3>
          <div style={{ display:'grid', gap:16 }}>
            <Toggle checked={s.email_confirmation==='true'} onChange={v=>upd('email_confirmation',v)} label="Confirmation email to guest on booking"/>
            <Toggle checked={s.email_cancellation==='true'} onChange={v=>upd('email_cancellation',v)} label="Cancellation email to guest"/>
            <Toggle checked={s.email_reminder==='true'} onChange={v=>upd('email_reminder',v)} label="Reminder email before reservation"/>
            {s.email_reminder==='true'&&(
              <div style={{ marginLeft:56, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:13, color:B.gray }}>Send reminder</span>
                <input type="number" min={1} max={72} value={s.reminder_hours||24} onChange={e=>upd('reminder_hours',e.target.value)}
                  style={{...S.input,width:70}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                <span style={{ fontSize:13, color:B.gray }}>hours before</span>
              </div>
            )}
          </div>
        </div>

        {/* Resend */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:4 }}>🔑 Resend API Key</h3>
          <p style={{ fontSize:12, color:B.gray, marginBottom:16 }}>Get your key at <a href="https://resend.com" target="_blank" style={{ color:B.orange }}>resend.com</a></p>
          <Input label="API Key" value={s.resend_api_key||''} onChange={v=>upd('resend_api_key',v)} placeholder="re_xxxxxxxxxxxx"/>
          <div style={{ marginTop:12 }}>
            <Input label="From email" value={s.resend_from||''} onChange={v=>upd('resend_from',v)} placeholder="reservations@underhusetlofoten.com"/>
          </div>
          <div style={{ marginTop:12 }}>
            <Input label="App URL (for email links)" value={s.app_url||''} onChange={v=>upd('app_url',v)} placeholder="https://reservas.underhusetlofoten.com"/>
          </div>
        </div>

        {/* Booking rules */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>⚙️ Booking Rules</h3>
          <div style={{ display:'grid', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:B.gray }}>Min guests per online reservation</span>
              <input type="number" min={1} max={4} value={s.min_guests_online||1} onChange={e=>upd('min_guests_online',e.target.value)}
                style={{...S.input,width:70}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:B.gray }}>Max guests per online reservation</span>
              <input type="number" min={1} max={20} value={s.max_guests_online||4} onChange={e=>upd('max_guests_online',e.target.value)}
                style={{...S.input,width:70}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:B.gray }}>No-show grace period (minutes)</span>
              <input type="number" min={5} max={60} value={s.no_show_minutes||15} onChange={e=>upd('no_show_minutes',e.target.value)}
                style={{...S.input,width:70}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:B.gray }}>Waitlist confirmation window (hours)</span>
              <input type="number" min={1} max={24} value={s.waitlist_confirm_hours||2} onChange={e=>upd('waitlist_confirm_hours',e.target.value)}
                style={{...S.input,width:70}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
          </div>
        </div>

        {/* Breakfast */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🍳 Breakfast Buffet</h3>
          <div style={{ display:'grid', gap:16 }}>
            <Toggle checked={s.breakfast_enabled==='true'} onChange={v=>upd('breakfast_enabled',v)} label="Breakfast reservations enabled"/>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:B.gray }}>Hours</span>
              {['breakfast_from','breakfast_to'].map((field,i)=>(
                <>
                  {i>0 && <span key="to" style={{ fontSize:13, color:B.gray }}>to</span>}
                  <select key={field} value={s[field]||(i===0?'08:00':'11:00')} onChange={e=>upd(field,e.target.value)}
                    style={{...S.input,width:'auto',padding:'8px 12px',cursor:'pointer'}}
                    onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}>
                    {Array.from({length:24*2},(_,j)=>{ const h=Math.floor(j/2),m=j%2?'30':'00'; return `${String(h).padStart(2,'0')}:${m}` }).map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:B.gray }}>Max guests per day</span>
              <input type="number" min={1} max={200} value={s.breakfast_max_guests||44} onChange={e=>upd('breakfast_max_guests',e.target.value)}
                style={{...S.input,width:80}} onFocus={e=>e.target.style.borderColor=B.orange} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
            </div>
          </div>
        </div>

        {/* Hotels */}
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:4 }}>🏨 Partner Properties</h3>
          <p style={{ fontSize:12, color:B.gray, marginBottom:16 }}>Each partner gets their own link showing only their properties.</p>

          {[
            { key:'hotels_ingrid', label:"Ingrid's properties", link:'/hotel/ingrid', color:B.orange },
            { key:'hotels_marta',  label:"Marta's properties",  link:'/hotel/marta',  color:B.blue  },
          ].map(({ key, label, link, color }) => {
            let list = []
            try { list = JSON.parse(s[key]||'[]') } catch {}
            return (
              <div key={key} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ ...S.label, color, marginBottom:0 }}>{label}</label>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <code style={{ fontSize:11, color:B.gray, background:B.grayLight, padding:'2px 8px', borderRadius:6 }}>{link}</code>
                    <button onClick={()=>navigator.clipboard.writeText(window.location.origin+link)}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:`1px solid ${B.grayLight}`, background:'#fff', cursor:'pointer', color:B.gray }}>
                      Copy
                    </button>
                  </div>
                </div>
                <div style={{ display:'grid', gap:8 }}>
                  {list.map((h,i)=>(
                    <div key={i} style={{ display:'flex', gap:8 }}>
                      <input value={h} onChange={e=>{ const next=[...list]; next[i]=e.target.value; upd(key,JSON.stringify(next)) }}
                        style={{...S.input,flex:1}}
                        onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor=B.grayLight}/>
                      <button onClick={()=>{ const next=list.filter((_,j)=>j!==i); upd(key,JSON.stringify(next)) }}
                        style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${B.red}`, background:B.redLight, color:B.red, cursor:'pointer', fontWeight:700 }}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>{ const next=[...list,'']; upd(key,JSON.stringify(next)) }}
                    style={{ padding:'8px 16px', borderRadius:10, border:`2px dashed ${B.grayLight}`, background:'transparent', color:B.gray, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                    + Add property
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:700, color:B.dark, marginBottom:16 }}>🏷️ Tags</h3>
          <TagManager tags={tags} onTagsChange={onTagsChange}/>
        </div>

        <div><Btn onClick={save}>{saved?'✓ Saved':'Save changes'}</Btn></div>
      </div>
    </div>
  )
}

// ─── Main Admin ───────────────────────────────────────────────────────────────

const TABS = [
  { id:'dashboard',    icon:'📊', label:'Today'        },
  { id:'reservations', icon:'📋', label:'Reservations' },
  { id:'waitlist',     icon:'⏳', label:'Waitlist'     },
  { id:'breakfast',    icon:'🍳', label:'Breakfast'    },
  { id:'stats',        icon:'📈', label:'Stats'        },
  { id:'tables',       icon:'🪑', label:'Tables'       },
  { id:'settings',     icon:'⚙️', label:'Settings'     },
]

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Invalid email or password'); setLoading(false) }
    else onLogin()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6F0', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans','Helvetica Neue',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 8px 40px rgba(60,66,66,.12)', width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🍽️</div>
          <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, color:'#3C4242', margin:0 }}>Underhuset</h2>
          <p style={{ color:'#8A8F8F', fontSize:13, margin:'6px 0 0' }}>Backoffice — Staff only</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#3C4242', marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase' }}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'2px solid #E2E6E6', fontSize:14, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#F99D54'} onBlur={e=>e.target.style.borderColor='#E2E6E6'}
            onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#3C4242', marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase' }}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'2px solid #E2E6E6', fontSize:14, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#F99D54'} onBlur={e=>e.target.style.borderColor='#E2E6E6'}
            onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        </div>
        {error && <p style={{ color:'#E05252', fontSize:13, textAlign:'center', marginBottom:12 }}>{error}</p>}
        <button onClick={handleLogin} disabled={loading||!email||!password} style={{
          width:'100%', padding:'14px', borderRadius:12, border:'none', background: loading||!email||!password?'#E2E6E6':'#F99D54',
          color: loading||!email||!password?'#8A8F8F':'#fff', fontSize:15, fontWeight:700, cursor: loading||!email||!password?'not-allowed':'pointer'
        }}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </div>
    </div>
  )
}

function AdminContent({ role }) {
  const [tab,          setTab]          = useState('dashboard')
  const [reservations, setReservations] = useState([])
  const [tables,       setTables]       = useState([])
  const [waitlist,     setWaitlist]     = useState([])
  const [breakfast,    setBreakfast]    = useState([])
  const [settings,     setSettings]     = useState({})
  const [loading,      setLoading]      = useState(true)
  const [newModal,     setNewModal]     = useState(false)
  const [editModal,    setEditModal]    = useState(null)
  const [deleteModal,  setDeleteModal]  = useState(null)
  const [walkInModal,  setWalkInModal]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [deleted,      setDeleted]      = useState([])
  const [showDeleted,  setShowDeleted]  = useState(false)
  const [tags,         setTags]         = useState([])

  const loadAll = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    try {
      const [res, tbl, wl, bfst, set] = await Promise.all([
        getReservations(), getTables(), getWaitlist(),
        getBreakfastReservations(), getSettings()
      ])
      setReservations(res||[]); setTables(tbl||[]); setWaitlist(wl||[])
      const del = await getDeletedReservations(); setDeleted(del||[])
      const tgs = await getTags(); setTags(tgs||[])
      setBreakfast(bfst||[]); setSettings(set||{})
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ loadAll() },[loadAll])
  useEffect(()=>{
    const id=setInterval(()=>{ if(['dashboard','reservations','waitlist'].includes(tab)) loadAll(true) },30_000)
    return()=>clearInterval(id)
  },[loadAll, tab])

  useEffect(()=>{
    const autoComplete = async () => {
      const now = new Date()
      const seated = reservations.filter(r => r.status === 'seated' && r.seated_at)
      for (const r of seated) {
        const mins = (now - new Date(r.seated_at)) / 60000
        if (mins >= 90) await updateReservation(r.id, { status: 'completed' })
      }
      if (seated.length > 0) loadAll()
    }
    const id = setInterval(autoComplete, 5 * 60 * 1000)
    return () => clearInterval(id)
  },[reservations, loadAll])

  useEffect(()=>{
    const autoCompleteBreakfast = async () => {
      const now = new Date()
      const seated = breakfast.filter(r => r.status === 'seated' && r.seated_at)
      for (const r of seated) {
        const mins = (now - new Date(r.seated_at)) / 60000
        if (mins >= 40) await updateBreakfastReservation(r.id, { status: 'completed' })
      }
      if (seated.length > 0) loadAll()
    }
    const id = setInterval(autoCompleteBreakfast, 5 * 60 * 1000)
    return () => clearInterval(id)
  },[breakfast, loadAll])

  const handleCreate = async (f) => {
    setSaving(true)
    try {
      const r = await createReservation({ date:f.date, time:f.time, guests:parseInt(f.guests),
        first_name:f.first_name, last_name:f.last_name, email:f.email, phone:f.phone,
        notes:f.notes, merged_with:f.merged_with||null, tag_ids:JSON.stringify(f.tag_ids||[]), status:f.status,
        table_id: f.table_ids?.length===1 ? f.table_ids[0] : null,
        table_ids: f.table_ids||[],
        is_manual:true })
      if (settings.email_confirmation==='true') await sendEmail('confirmation', { reservation:r })
      setNewModal(false); loadAll()
    } finally { setSaving(false) }
  }

  const handleUpdate = async (f) => {
    setSaving(true)
    try {
      await updateReservation(editModal.id, { date:f.date, time:f.time, guests:parseInt(f.guests),
        first_name:f.first_name, last_name:f.last_name, email:f.email, phone:f.phone,
        notes:f.notes, merged_with:f.merged_with||null, tag_ids:JSON.stringify(f.tag_ids||[]), status:f.status,
        table_id: f.table_ids?.length===1 ? f.table_ids[0] : null,
        table_ids: f.table_ids||[] })
      if (f.status==='cancelled' && editModal.status!=='cancelled') {
        const next = await getNextWaiting(f.date, f.time)
        if (next) {
          await updateWaitlistEntry(next.id, { status:'notified', notified_at:new Date().toISOString() })
          await sendEmail('waitlist_spot', { entry:next })
        }
        if (settings.email_cancellation==='true') await sendEmail('cancellation', { reservation:editModal })
      }
      setEditModal(null); loadAll()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    await deleteReservation(deleteModal.id); setDeleteModal(null); loadAll()
  }

  const handleSeated = async (r) => {
    await seatReservation(r.id); loadAll()
  }

  const handleEarlyFree = async (r) => {
    await earlyFreeReservation(r.id)
    const next = await getNextWaiting(r.date, r.time)
    if (next) {
      await updateWaitlistEntry(next.id, { status:'notified', notified_at:new Date().toISOString() })
      await sendEmail('waitlist_spot', { entry:next })
    }
    loadAll()
  }

  const handleWalkIn = async (f) => {
    setSaving(true)
    try { await createReservation(f); setWalkInModal(false); loadAll() }
    finally { setSaving(false) }
  }

  const waitlistCount = waitlist.filter(e=>e.status==='waiting').length

  return (
    <div style={{ minHeight:'100vh', background:B.cream }}>
      {/* Top bar */}
      <div style={{ background:B.dark, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:8,background:B.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🍽️</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:16, fontWeight:700, color:'#fff' }}>Underhuset</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', letterSpacing:'.06em', textTransform:'uppercase', marginLeft:8 }}>Admin</span>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:'rgba(255,255,255,.1)', border:'none', borderRadius:8, color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600, padding:'6px 14px', cursor:'pointer' }}>Sign out</button>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {TABS.filter(t => t.id !== 'settings' || role === 'admin').map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?B.orange:'transparent', border:'none', borderRadius:8, cursor:'pointer',
              padding:'6px 12px', color:tab===t.id?'#fff':'rgba(255,255,255,.6)',
              fontSize:13, fontWeight:tab===t.id?700:400, display:'flex', alignItems:'center', gap:5,
            }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.id==='waitlist'&&waitlistCount>0&&<span style={{ background:B.red, color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{waitlistCount}</span>}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadAll} style={{ background:'none', border:`1px solid rgba(255,255,255,.2)`, borderRadius:8, cursor:'pointer', padding:'4px 12px', color:'rgba(255,255,255,.7)', fontSize:12 }}>↻ Refresh</button>
          <a href="/" target="_blank" style={{ background:'none', border:`1px solid rgba(255,255,255,.2)`, borderRadius:8, cursor:'pointer', padding:'4px 12px', color:'rgba(255,255,255,.7)', fontSize:12, textDecoration:'none' }}>🌐 Web</a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'95%', margin:'0 auto', padding:'28px 24px' }}>
        {loading ? <div style={{ textAlign:'center', padding:80, color:B.gray }}>Loading…</div> : (
          <>
            {tab==='dashboard'    && <Dashboard reservations={reservations} tables={tables} tags={tags}
              onEditReservation={r=>setEditModal(r)}
              onSeated={handleSeated} onEarlyFree={handleEarlyFree}
              onWalkIn={()=>setWalkInModal(true)} onRefresh={loadAll}/>}
            {tab==='reservations' && <>
              <ReservationsList reservations={reservations} tables={tables} tags={tags}
                onNew={()=>setNewModal(true)} onEdit={r=>setEditModal(r)} onDelete={r=>setDeleteModal(r)}
                onSeated={handleSeated} onEarlyFree={handleEarlyFree}/>
              {deleted.length > 0 && (
                <div style={{ marginTop:24 }}>
                  <button onClick={()=>setShowDeleted(v=>!v)} style={{ background:'none', border:'1px solid #E2E6E6', borderRadius:8, padding:'8px 16px', fontSize:13, cursor:'pointer', color:'#8A8F8F' }}>
                    🗑️ {showDeleted ? 'Hide' : 'Show'} deleted reservations ({deleted.length})
                  </button>
                  {showDeleted && (
                    <div style={{ marginTop:12, border:'1px solid #E2E6E6', borderRadius:12, overflow:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead><tr style={{ background:'#FAF6F0' }}>
                          {['Code','Date','Time','Name','Guests','Email','Deleted at',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#8A8F8F', textTransform:'uppercase' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {deleted.map(r=>(
                            <tr key={r.id} style={{ borderTop:'1px solid #E2E6E6' }}>
                              <td style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:'#8A8F8F' }}>{r.reservation_code||'—'}</td>
                              <td style={{ padding:'10px 12px' }}>{r.date}</td>
                              <td style={{ padding:'10px 12px' }}>{r.time?.slice(0,5)}</td>
                              <td style={{ padding:'10px 12px' }}>{r.first_name} {r.last_name||''}</td>
                              <td style={{ padding:'10px 12px' }}>{r.guests}</td>
                              <td style={{ padding:'10px 12px', color:'#8A8F8F', fontSize:12 }}>{r.email}</td>
                              <td style={{ padding:'10px 12px', color:'#8A8F8F', fontSize:12 }}>{new Date(r.deleted_at).toLocaleDateString('en-GB')}</td>
                              <td style={{ padding:'10px 12px' }}>
                                <button onClick={async()=>{ await restoreReservation(r.id); loadAll() }} style={{ background:'#D1FAE5', border:'none', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:700, color:'#065F46', cursor:'pointer' }}>↩ Restore</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>}
            {tab==='waitlist'  && <WaitlistTab waitlist={waitlist} onRefresh={loadAll}/>}
            {tab==='breakfast' && <BreakfastTab breakfast={breakfast} settings={settings} onRefresh={loadAll}/>}
            {tab==='stats'     && <StatsTab reservations={reservations} breakfast={breakfast} settings={settings}/>}
            {tab==='tables'    && <TablesManager tables={tables} onRefresh={loadAll}/>}
            {tab==='settings' && role==='admin' && <SettingsTab settings={settings} onSave={s=>setSettings(s)} tags={tags} onTagsChange={()=>getTags().then(setTags)}/>}
          </>
        )}
      </div>

      {newModal    && <Modal title="New manual reservation" onClose={()=>setNewModal(false)}><ReservationForm tables={tables} tags={tags} onSave={handleCreate} onCancel={()=>setNewModal(false)} loading={saving}/></Modal>}
      {editModal   && <Modal title="Edit reservation" onClose={()=>setEditModal(null)}><ReservationForm initial={{...editModal, time:fmtTime(editModal.time), table_ids:editModal.table_ids||[]}} tables={tables} tags={tags} onSave={handleUpdate} onCancel={()=>setEditModal(null)} loading={saving}/></Modal>}
      {deleteModal && <Confirm message={`Delete reservation for ${deleteModal.first_name} ${deleteModal.last_name} (${fmtDate(deleteModal.date)}, ${fmtTime(deleteModal.time)})?`} onYes={handleDelete} onNo={()=>setDeleteModal(null)}/>}
      {walkInModal && <WalkInModal tables={tables} onSave={handleWalkIn} onClose={()=>setWalkInModal(false)} loading={saving}/>}
    </div>
  )
}

function ClosedPeriods({ settings, onUpdate }) {
  let periods = []
  try { periods = JSON.parse(settings.closed_periods||'[]') } catch {}
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')
  const [label, setLabel] = useState('')

  const add = () => {
    if (!from || !to) return
    const updated = [...periods, { from, to, label: label||'Closed' }]
    onUpdate('closed_periods', JSON.stringify(updated))
    setFrom(''); setTo(''); setLabel('')
  }

  const remove = (i) => {
    const updated = periods.filter((_,idx)=>idx!==i)
    onUpdate('closed_periods', JSON.stringify(updated))
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      {periods.length===0 && <p style={{ fontSize:13, color:B.gray }}>No closed periods set.</p>}
      {periods.map((p,i)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:B.orangePale, borderRadius:8, padding:'10px 14px' }}>
          <span style={{ fontSize:13, fontWeight:700, color:B.dark }}>🚫 {p.label}</span>
          <span style={{ fontSize:13, color:B.gray }}>{p.from} → {p.to}</span>
          <button onClick={()=>remove(i)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:B.red, fontSize:16 }}>×</button>
        </div>
      ))}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, marginTop:8 }}>
        <div>
          <label style={S.label}>From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={S.input}/>
        </div>
        <div>
          <label style={S.label}>To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Label (optional)</label>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Winter break" style={S.input}/>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end' }}>
          <Btn onClick={add} disabled={!from||!to}>+ Add</Btn>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadRole(data.session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadRole(s.user.id)
      else setRole(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadRole = async (userId) => {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single()
    setRole(data?.role || 'staff')
  }

  if (session === undefined) return null
  if (!session) return <LoginPage onLogin={() => {}} />
  return <AdminContent role={role} />
}
