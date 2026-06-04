import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import UserTable from '../components/users/UserTable'
import UserModal from '../components/users/UserModal'
import DataTable from '../components/common/DataTable'
import CustomerTable from '../components/customers/CustomerTable'
import CustomerModal from '../components/customers/CustomerModal'
import SupplierTable from '../components/suppliers/SupplierTable'
import SupplierModal from '../components/suppliers/SupplierModal'

const API = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
const VALID_SECTIONS = ['users', 'departments', 'positions', 'customers', 'suppliers']

export default function QuantriPage() {
  const { user } = useAuth()
  const { section } = useParams()

  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [managers, setManagers] = useState([])
  const [customers, setCustomers] = useState([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState(null)
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState(null)

  async function loadUsers() {
    try { setUsers(await fetch(`${API}/api/users`).then(r => r.json())) } catch (e) { console.error(e) }
  }
  async function loadCustomers() {
    try { setCustomers(await fetch(`${API}/api/customers`).then(r => r.json())) } catch (e) { console.error(e) }
  }
  async function loadSuppliers() {
    try { setSuppliers(await fetch(`${API}/api/suppliers`).then(r => r.json())) } catch (e) { console.error(e) }
  }

  useEffect(() => {
    loadUsers()
    loadCustomers()
    loadSuppliers()
    Promise.all([
      fetch(`${API}/api/departments`).then(r => r.json()),
      fetch(`${API}/api/positions`).then(r => r.json()),
      fetch(`${API}/api/managers`).then(r => r.json()),
    ]).then(([d, p, m]) => { setDepartments(d); setPositions(p); setManagers(m) }).catch(console.error)
  }, [])

  async function checkEmailExists(emailToCheck, callback) {
    if (!emailToCheck?.includes('@')) { callback(false); return }
    try {
      const res = await fetch(`${API}/api/users/check-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailToCheck }) })
      callback((await res.json()).exists)
    } catch { callback(false) }
  }

  async function checkUsernameExists(usernameToCheck, callback) {
    if (!usernameToCheck) { callback(false); return }
    try {
      const res = await fetch(`${API}/api/users/check-username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: usernameToCheck }) })
      callback((await res.json()).exists)
    } catch { callback(false) }
  }

  async function checkEmployeeCodeExists(codeToCheck, callback) {
    if (!codeToCheck) { callback(false); return }
    try {
      const res = await fetch(`${API}/api/users/check-employee-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_code: codeToCheck }) })
      callback((await res.json()).exists)
    } catch { callback(false) }
  }

  async function handleSaveUser(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/users/${editingUserId}` : `${API}/api/users`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadUsers()
      setShowAddModal(false); setShowEditModal(false); setEditingUserId(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleSaveCustomer(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/customers/${editingCustomerId}` : `${API}/api/customers`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadCustomers()
      setShowAddCustomerModal(false); setShowEditCustomerModal(false); setEditingCustomerId(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleSaveSupplier(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/suppliers/${editingSupplierId}` : `${API}/api/suppliers`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadSuppliers()
      setShowAddSupplierModal(false); setShowEditSupplierModal(false); setEditingSupplierId(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  if (!VALID_SECTIONS.includes(section)) return <Navigate to="/quantri/users" replace />

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <Sidebar />
        <section className="content-area">

          {section === 'users' && (
            <>
              <h2 className="section-title">QUẢN LÝ NGƯỜI DÙNG</h2>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                {user?.role == 1 && (
                  <button className="add-btn" onClick={() => setShowAddModal(true)}>Thêm người dùng</button>
                )}
                <div style={{ flex: 1, maxWidth: '300px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Tìm kiếm (Tên, Email, SĐT...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                </div>
              </div>
              <UserTable users={users} searchTerm={searchTerm} userRole={user?.role} onEdit={(u) => { setEditingUserId(u.id); setShowEditModal(true) }} />
              <UserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleSaveUser} departments={departments} positions={positions} managers={managers} checkEmailExists={checkEmailExists} checkUsernameExists={checkUsernameExists} checkEmployeeCodeExists={checkEmployeeCodeExists} />
              <UserModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingUserId(null) }} onSave={handleSaveUser} user={users.find(u => u.id === editingUserId)} departments={departments} positions={positions} managers={managers} checkEmailExists={checkEmailExists} checkUsernameExists={checkUsernameExists} checkEmployeeCodeExists={checkEmployeeCodeExists} />
            </>
          )}

          {section === 'departments' && (
            <DataTable
              title="QUẢN LÝ PHÒNG BAN"
              columns={[{ header: 'Mã phòng ban', field: 'code' }, { header: 'Tên phòng ban', field: 'name' }]}
              data={departments}
            />
          )}

          {section === 'positions' && (
            <DataTable
              title="QUẢN LÝ VỊ TRÍ"
              columns={[{ header: 'Mã vị trí', field: 'code' }, { header: 'Tên vị trí', field: 'name' }]}
              data={positions}
            />
          )}

          {section === 'customers' && (
            <>
              <h2 className="section-title">QUẢN LÝ KHÁCH HÀNG</h2>
              <div className="content-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {user?.role == 1 && (
                  <button className="add-btn" onClick={() => setShowAddCustomerModal(true)}>Thêm khách hàng</button>
                )}
                <div style={{ maxWidth: '300px' }}>
                  <input type="text" placeholder="🔍 Tìm kiếm (Tên, Mã, MST, SĐT...)" value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }} />
                </div>
              </div>
              <div className="content-scrollable">
                <CustomerTable customers={customers} searchTerm={customerSearchTerm} userRole={user?.role} onEdit={(c) => { setEditingCustomerId(c.id); setShowEditCustomerModal(true) }} />
              </div>
              <CustomerModal isOpen={showAddCustomerModal} onClose={() => setShowAddCustomerModal(false)} onSave={handleSaveCustomer} />
              <CustomerModal isOpen={showEditCustomerModal} onClose={() => { setShowEditCustomerModal(false); setEditingCustomerId(null) }} onSave={handleSaveCustomer} customer={customers.find(c => c.id === editingCustomerId)} />
            </>
          )}

          {section === 'suppliers' && (
            <>
              <h2 className="section-title">QUẢN LÝ NHÀ CUNG CẤP</h2>
              <div className="content-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {user?.role == 1 && (
                  <button className="add-btn" onClick={() => setShowAddSupplierModal(true)}>Thêm nhà cung cấp</button>
                )}
                <div style={{ maxWidth: '300px' }}>
                  <input type="text" placeholder="🔍 Tìm kiếm (Tên, Mã, MST, SĐT...)" value={supplierSearchTerm} onChange={e => setSupplierSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }} />
                </div>
              </div>
              <div className="content-scrollable">
                <SupplierTable suppliers={suppliers} searchTerm={supplierSearchTerm} userRole={user?.role} onEdit={(s) => { setEditingSupplierId(s.id); setShowEditSupplierModal(true) }} />
              </div>
              <SupplierModal isOpen={showAddSupplierModal} onClose={() => setShowAddSupplierModal(false)} onSave={handleSaveSupplier} />
              <SupplierModal isOpen={showEditSupplierModal} onClose={() => { setShowEditSupplierModal(false); setEditingSupplierId(null) }} onSave={handleSaveSupplier} supplier={suppliers.find(s => s.id === editingSupplierId)} />
            </>
          )}

        </section>
      </div>
    </main>
  )
}
