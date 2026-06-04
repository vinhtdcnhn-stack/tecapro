import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ContractListPage from '../components/contracts/ContractListPage'

const API = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')

export default function QldaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState([])
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])

  async function loadContracts() {
    try {
      const res = await fetch(`${API}/api/contracts`)
      setContracts(await res.json())
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    loadContracts()
    fetch(`${API}/api/users`).then(r => r.json()).then(setUsers).catch(console.error)
    fetch(`${API}/api/customers`).then(r => r.json()).then(setCustomers).catch(console.error)
  }, [])

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <section className="content-area">
          <ContractListPage
            contracts={contracts}
            onManage={(c) => navigate(`/qlda/${c.id}`)}
            onLoadContracts={loadContracts}
            currentUser={user}
            users={users}
            customers={customers}
          />
        </section>
      </div>
    </main>
  )
}
