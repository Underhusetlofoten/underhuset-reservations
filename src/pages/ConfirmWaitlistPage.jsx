import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { B } from '../brand.js'
import { getWaitlistByToken, updateWaitlistEntry, createReservation, sendEmail } from '../lib/supabase.js'

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
}
function fmtTime(t) { return t ? t.slice(0,5) : '' }

export default function ConfirmWaitlistPage() {
  const { token } = useParams()
  const [entry,  setEntry]  = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getWaitlistByToken(token).then(e => {
      if (!e) { setStatus('error'); return }
      if (e.status === 'confirmed') { setStatus('already'); return }
      if (e.status === 'expired')   { setStatus('expired'); return }
      setEntry(e)
      setStatus('found')
    })
  }, [token])

  const confirm = async () => {
    setStatus('loading')
    const r = await createReservation({
      date: entry.date, time: entry.time, guests: entry.guests,
      first_name: entry.first_name, last_name: entry.last_name,
      email: entry.email, phone: entry.phone,
      status: 'confirmed', is_manual: false,
    })
    await updateWaitlistEntry(entry.id, { status: 'confirmed' })
    await sendEmail('confirmation', { reservation: r })
    setStatus('done')
  }

  return (
    <div style={{
      minHeight:'100vh', background:`linear-gradient(135deg, ${B.cream}, #fff, ${B.purpleLight})`,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:B.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🍽️</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:700, color:B.dark }}>Underhuset</span>
        </div>
      </div>
      <div style={{ width:'100%', maxWidth:460, background:B.cream, borderRadius:24, padding:'32px 28px',
        boxShadow:`0 8px 48px rgba(60,66,66,.12)`, textAlign:'center' }}>

        {status==='loading' && <p style={{ color:B.gray }}>Loading…</p>}

        {status==='error' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:12 }}>Link not found</h2>
            <p style={{ color:B.gray, fontSize:14 }}>This link is invalid or has expired.</p>
          </>
        )}

        {status==='expired' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>⏰</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:12 }}>Link expired</h2>
            <p style={{ color:B.gray, fontSize:14, marginBottom:20 }}>This spot has been offered to the next person on the waitlist.</p>
            <a href="/" style={{ display:'inline-block', padding:'12px 24px', borderRadius:12, background:B.orange,
              color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>Try booking again</a>
          </>
        )}

        {status==='already' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark }}>Already confirmed!</h2>
            <p style={{ color:B.gray, fontSize:14, marginTop:8 }}>Your reservation is confirmed. See you soon!</p>
          </>
        )}

        {status==='found' && entry && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:8 }}>A spot is available!</h2>
            <p style={{ color:B.gray, fontSize:14, marginBottom:24 }}>Confirm within 2 hours to secure your table.</p>
            <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:24, textAlign:'left' }}>
              {[
                ['📅', fmtDate(entry.date)],
                ['⏰', fmtTime(entry.time)],
                ['👤', `${entry.first_name} ${entry.last_name}`],
              ].map(([icon,val])=>(
                <div key={icon} style={{ display:'flex', gap:10, padding:'6px 0', borderBottom:`1px solid ${B.grayLight}`, fontSize:13 }}>
                  <span>{icon}</span><span style={{ color:B.dark, fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
            <button onClick={confirm} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none',
              background:B.orange, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              ✓ Confirm my reservation
            </button>
          </>
        )}

        {status==='done' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', color:B.dark, marginBottom:8 }}>Reservation confirmed!</h2>
            <p style={{ color:B.gray, fontSize:14, marginBottom:20 }}>
              Your confirmation email is on its way. We look forward to welcoming you!
            </p>
            <a href="/" style={{ display:'inline-block', padding:'12px 24px', borderRadius:12,
              background:B.orange, color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>
              Back to home
            </a>
          </>
        )}
      </div>
    </div>
  )
}
