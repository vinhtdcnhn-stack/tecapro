import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  useUsers, useCustomers, useSuppliers, useDepartments, usePositions, useManagers, useBbTypes, qk,
} from '../lib/queries'
import Sidebar from '../components/layout/Sidebar'
import UserTable from '../components/users/UserTable'
import UserModal from '../components/users/UserModal'
import DataTable from '../components/common/DataTable'
import CustomerTable from '../components/customers/CustomerTable'
import CustomerModal from '../components/customers/CustomerModal'
import SupplierTable from '../components/suppliers/SupplierTable'
import SupplierModal from '../components/suppliers/SupplierModal'
import CodeNameModal from '../components/common/CodeNameModal'
import TelegramLogPanel from '../components/admin/TelegramLogPanel'
import FeedbackPanel from '../components/admin/FeedbackPanel'
import BackupPanel from '../components/admin/BackupPanel'

const VALID_SECTIONS = ['users', 'departments', 'positions', 'customers', 'suppliers', 'bb-types', 'telegram-log', 'feedback', 'backup']
// Các section chỉ admin (role==1) mới được xem.
const ADMIN_ONLY_SECTIONS = ['telegram-log', 'backup']

export default function QuantriPage() {
  const { user } = useAuth()
  const { section } = useParams()

  const queryClient = useQueryClient()
  // Tất cả danh sách quản trị lấy qua TanStack Query: render NGAY từ cache (nhiều cái dùng
  // chung với module HĐ nên thường đã được nạp sẵn), làm mới ngầm theo SWR. Sửa/thêm xong
  // thì invalidate đúng key thay vì gọi loader thủ công.
  const { data: users = [] } = useUsers()
  const { data: customers = [] } = useCustomers()
  const { data: suppliers = [] } = useSuppliers()
  const { data: departments = [] } = useDepartments()
  const { data: positions = [] } = usePositions()
  const { data: managers = [] } = useManagers()
  const { data: bbTypes = [] } = useBbTypes()

  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
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
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState(null)
  const [showBBTypeModal, setShowBBTypeModal] = useState(false)
  const [editingBBType, setEditingBBType] = useState(null)

  // Làm mới một danh sách trong cache sau khi thêm/sửa (tương đương loadXxx() cũ).
  const invalidate = (key) => queryClient.invalidateQueries({ queryKey: key })

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
      invalidate(qk.users)
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
      invalidate(qk.customers)
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
      invalidate(qk.suppliers)
      setShowAddSupplierModal(false); setShowEditSupplierModal(false); setEditingSupplierId(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleSaveDepartment(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/departments/${editingDept.id}` : `${API}/api/departments`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      invalidate(qk.departments)
      setShowDeptModal(false); setEditingDept(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleSavePosition(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/positions/${editingPosition.id}` : `${API}/api/positions`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      invalidate(qk.positions)
      setShowPositionModal(false); setEditingPosition(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleSaveBBType(formData, isEdit) {
    try {
      const url    = isEdit ? `${API}/api/bb-types/${editingBBType.id}` : `${API}/api/bb-types`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      invalidate(qk.bbTypes)
      setShowBBTypeModal(false); setEditingBBType(null)
    } catch { alert('Có lỗi xảy ra.') }
  }

  if (!VALID_SECTIONS.includes(section)) return <Navigate to="/quantri/users" replace />
  // Section dành riêng admin: người không phải admin bị đẩy về trang người dùng.
  if (ADMIN_ONLY_SECTIONS.includes(section) && user?.role != 1) return <Navigate to="/quantri/users" replace />

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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', minWidth: '180px' }}
                  >
                    <option value="">Tất cả phòng ban</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <div style={{ maxWidth: '300px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Tìm kiếm (Tên, Email, SĐT...)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                    />
                  </div>
                </div>
              </div>
              <UserTable users={users} searchTerm={searchTerm} departmentFilter={departmentFilter} userRole={user?.role} onEdit={(u) => { setEditingUserId(u.id); setShowEditModal(true) }} />
              <UserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleSaveUser} departments={departments} positions={positions} managers={managers} checkEmailExists={checkEmailExists} checkUsernameExists={checkUsernameExists} checkEmployeeCodeExists={checkEmployeeCodeExists} />
              <UserModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingUserId(null) }} onSave={handleSaveUser} user={users.find(u => u.id === editingUserId)} departments={departments} positions={positions} managers={managers} checkEmailExists={checkEmailExists} checkUsernameExists={checkUsernameExists} checkEmployeeCodeExists={checkEmployeeCodeExists} />
            </>
          )}

          {section === 'departments' && (
            <>
              <DataTable
                title="QUẢN LÝ PHÒNG BAN"
                headerActions={user?.role == 1 && (
                  <button className="add-btn" onClick={() => { setEditingDept(null); setShowDeptModal(true) }}>Thêm phòng ban</button>
                )}
                columns={[
                  { header: 'Mã phòng ban', field: 'code' },
                  { header: 'Tên phòng ban', field: 'name' },
                  ...(user?.role == 1 ? [{
                    header: 'Thao tác',
                    render: (d) => <button className="edit-btn" onClick={() => { setEditingDept(d); setShowDeptModal(true) }}>Sửa</button>,
                  }] : []),
                ]}
                data={departments}
              />
              <CodeNameModal
                isOpen={showDeptModal}
                onClose={() => { setShowDeptModal(false); setEditingDept(null) }}
                onSave={handleSaveDepartment}
                item={editingDept}
                titleAdd="THÊM PHÒNG BAN" titleEdit="SỬA PHÒNG BAN"
                codeLabel="Mã phòng ban" nameLabel="Tên phòng ban"
                labelledBy="dept-modal-title"
              />
            </>
          )}

          {section === 'positions' && (
            <>
              <DataTable
                title="QUẢN LÝ VỊ TRÍ"
                headerActions={user?.role == 1 && (
                  <button className="add-btn" onClick={() => { setEditingPosition(null); setShowPositionModal(true) }}>Thêm vị trí</button>
                )}
                columns={[
                  { header: 'Mã vị trí', field: 'code' },
                  { header: 'Tên vị trí', field: 'name' },
                  ...(user?.role == 1 ? [{
                    header: 'Thao tác',
                    render: (p) => <button className="edit-btn" onClick={() => { setEditingPosition(p); setShowPositionModal(true) }}>Sửa</button>,
                  }] : []),
                ]}
                data={positions}
              />
              <CodeNameModal
                isOpen={showPositionModal}
                onClose={() => { setShowPositionModal(false); setEditingPosition(null) }}
                onSave={handleSavePosition}
                item={editingPosition}
                titleAdd="THÊM VỊ TRÍ" titleEdit="SỬA VỊ TRÍ"
                codeLabel="Mã vị trí" nameLabel="Tên vị trí"
                labelledBy="position-modal-title"
              />
            </>
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

          {section === 'bb-types' && (
            <>
              <DataTable
                title="QUẢN LÝ LOẠI BIÊN BẢN"
                headerActions={user?.role == 1 && (
                  <button className="add-btn" onClick={() => { setEditingBBType(null); setShowBBTypeModal(true) }}>Thêm loại biên bản</button>
                )}
                columns={[
                  { header: 'Mã', field: 'code' },
                  { header: 'Tên đầy đủ', field: 'name' },
                  ...(user?.role == 1 ? [{
                    header: 'Thao tác',
                    render: (t) => <button className="edit-btn" onClick={() => { setEditingBBType(t); setShowBBTypeModal(true) }}>Sửa</button>,
                  }] : []),
                ]}
                data={bbTypes}
              />
              <CodeNameModal
                isOpen={showBBTypeModal}
                onClose={() => { setShowBBTypeModal(false); setEditingBBType(null) }}
                onSave={handleSaveBBType}
                item={editingBBType}
                titleAdd="THÊM LOẠI BIÊN BẢN" titleEdit="SỬA LOẠI BIÊN BẢN"
                codeLabel="Mã" nameLabel="Tên đầy đủ"
                labelledBy="bbtype-modal-title"
              />
            </>
          )}

          {section === 'telegram-log' && <TelegramLogPanel />}

          {section === 'feedback' && <FeedbackPanel />}

          {section === 'backup' && <BackupPanel />}

        </section>
      </div>
    </main>
  )
}
