import { useState, useEffect } from 'react'
import { API_BASE as API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import homeHero from '../assets/home-hero.png'
import Dashboard from './Dashboard'
import PMDashboard from './PMDashboard'


export default function HomePage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])

  // User giữ vị trí PM TEAM → dashboard theo dõi tiến độ dự án
  const isPM = user?.positions?.some(p => p.code === 'PM_TEAM') || user?.position_code === 'PM_TEAM'

  useEffect(() => {
    if (!user || user.department_code !== '1') return
    Promise.all([
      fetch(`${API}/api/contracts`).then(r => r.json()),
      fetch(`${API}/api/customers`).then(r => r.json()),
      fetch(`${API}/api/users`).then(r => r.json()),
    ])
      .then(([c, cu, u]) => { setContracts(c); setCustomers(cu); setUsers(u) })
      .catch(console.error)
  }, [user])

  if (user && isPM) {
    return (
      <main className="page admin-page dash-page">
        <PMDashboard user={user} />
      </main>
    )
  }

  if (user && user.department_code === '1') {
    return (
      <main className="page admin-page dash-page">
        <Dashboard user={user} contracts={contracts} customers={customers} users={users} />
      </main>
    )
  }

  return (
    <main className="page page--home">
      <div className="home-hero">
        <img className="home-hero-img" src={homeHero} alt="" />
      </div>
    </main>
  )
}
