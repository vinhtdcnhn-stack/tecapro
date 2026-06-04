import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import homeHero from '../assets/home-hero.png'
import Dashboard from './Dashboard'

const API = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')

export default function HomePage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])

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

  if (user && user.department_code === '1') {
    return (
      <main className="page admin-page">
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
