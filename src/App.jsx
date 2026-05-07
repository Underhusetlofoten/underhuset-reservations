import { Routes, Route, Navigate } from 'react-router-dom'
import BookingPage          from './pages/BookingPage.jsx'
import AdminPage            from './pages/AdminPage.jsx'
import CancelPage           from './pages/CancelPage.jsx'
import ConfirmWaitlistPage  from './pages/ConfirmWaitlistPage.jsx'
import HotelBookingPage     from './pages/HotelBookingPage.jsx'
import BreakfastPage        from './pages/BreakfastPage.jsx'
import BreakfastSakrisoyPage from './pages/BreakfastSakrisoyPage.jsx'
import { ADMIN_SECRET }     from './brand.js'

export default function App() {
  return (
    <Routes>
      <Route path="/"                         element={<BookingPage breakfastLink="/breakfast" />} />
      <Route path="/sakrisoy"                    element={<BookingPage breakfastLink="/breakfast-sakrisoy" />} />
      <Route path="/hotel"                    element={<HotelBookingPage />} />
      <Route path="/hotel/:partner"           element={<HotelBookingPage />} />
      <Route path="/ingrid"                       element={<BookingPage breakfastLink="/ingrid-breakfast" />} />
      <Route path="/ingrid-breakfast"              element={<HotelBookingPage partner="ingrid" />} />
      <Route path="/marta"                        element={<HotelBookingPage partner="marta" />} />
      <Route path="/breakfast"                   element={<BreakfastPage />} />
      <Route path="/page"                          element={<BookingPage breakfastLink="/breakfast" />} />
      <Route path="/breakfast-sakrisoy"           element={<BreakfastSakrisoyPage />} />
      <Route path={`/${ADMIN_SECRET}`}        element={<AdminPage />} />
      <Route path="/cancel/:token"            element={<CancelPage />} />
      <Route path="/confirm-waitlist/:token"  element={<ConfirmWaitlistPage />} />
      <Route path="*"                         element={<Navigate to="/" replace />} />
    </Routes>
  )
}
