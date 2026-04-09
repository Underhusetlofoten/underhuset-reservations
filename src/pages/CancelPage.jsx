import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { B } from '../brand.js'
import { getReservationByToken, updateReservation, sendEmail } from '../lib/supabase.js'

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
}
function fmtTime(t) { return t ? t.slice(0,5) : '' }

export default function CancelPage() {
  const { token } = useParams()
  const [reservation, setReservation] = useState(null)
  const [status,      setStatus]      = useState('loading') // loading | found | already | done | error

  useEffect(() => {
    getReservationByToken(token).then(r => {
      if (!r) { setStatus('error'); return }
      if (['cancelled','no_show','completed','early_free'].includes(r.status)) { setStatus('already'); return }
      setReservation(r)
      setStatus('found')
    })
  }, [token])

  const cancel = async () => {
    setStatus('loading')
    await updateReservation(reservation.id, { status: 'cancelled' })
    await sendEmail('cancellation', { reservation })
    setStatus('done')
  }

  return (
    <div style={{
      minHeight:'100vh', background:`linear-gradient(135deg, ${B.cream}, #fff, ${B.orangeLight})`,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:B.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🍽️</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:700, color:B.dark }}>Underhuset</span>
        </div>
      </div>

      <div style={{ width:'100%', maxWidth:460, background:B.cream, borderRadius:24, padding:'32px 28px',
        boxShadow:`0 8px 48px rgba(60,66,66,.12)`, textAlign:'center' }}>

        {status === 'loading' && <p style={{ color:B.gray }}>Loading…</p>}

        {status === 'error' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:12 }}>Link not found</h2>
            <p style={{ color:B.gray, fontSize:14 }}>This cancellation link is invalid or has expired.</p>
          </>
        )}

        {status === 'already' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:12 }}>Already cancelled</h2>
            <p style={{ color:B.gray, fontSize:14 }}>This reservation has already been cancelled.</p>
          </>
        )}

        {status === 'found' && reservation && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:8 }}>Cancel reservation?</h2>
            <p style={{ color:B.gray, fontSize:14, marginBottom:24 }}>Are you sure you want to cancel this reservation?</p>
            <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:24, textAlign:'left' }}>
              {[
                ['📅', fmtDate(reservation.date)],
                ['⏰', fmtTime(reservation.time)],
                ['👥', `${reservation.guests} guest${reservation.guests>1?'s':''}`],
                ['👤', `${reservation.first_name} ${reservation.last_name}`],
              ].map(([icon,val])=>(
                <div key={icon} style={{ display:'flex', gap:10, padding:'6px 0', borderBottom:`1px solid ${B.grayLight}`, fontSize:13 }}>
                  <span>{icon}</span><span style={{ color:B.dark, fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <a href="/" style={{ flex:1, padding:'12px', borderRadius:12, border:`2px solid ${B.grayLight}`,
                background:'#fff', color:B.dark, fontSize:14, fontWeight:600, textDecoration:'none',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                Keep it
              </a>
              <button onClick={cancel} style={{ flex:2, padding:'12px', borderRadius:12, border:'none',
                background:B.red, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Yes, cancel
              </button>
            </div>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:8 }}>Reservation cancelled</h2>
            <p style={{ color:B.gray, fontSize:14, marginBottom:20 }}>
              We're sorry to see you go. We hope to welcome you at Underhuset another time.
            </p>
            <a href="/" style={{ display:'inline-block', padding:'12px 24px', borderRadius:12, background:B.orange,
              color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>
              Make a new reservation
            </a>
          </>
        )}
      </div>
    </div>
  )
}
