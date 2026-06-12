import { useState, useEffect, useCallback } from 'react'
import { API_BASE as API } from '../config/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ContractListPage from '../components/contracts/ContractListPage'


export default function QldaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState([])
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])

  // Backend lọc theo danh tính từ cookie phiên (req.user): admin xem tất cả, PM chỉ xem HĐ
  // mình phụ trách — không cần truyền userId. Memo hoá để ổn định (truyền xuống onLoadContracts).
  const loadContracts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/contracts`)
      setContracts(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadContracts() là async: setState xảy ra SAU await
    loadContracts()
    fetch(`${API}/api/users`).then(r => r.json()).then(setUsers).catch(console.error)
    fetch(`${API}/api/customers`).then(r => r.json()).then(setCustomers).catch(console.error)
  }, [user, loadContracts])

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
