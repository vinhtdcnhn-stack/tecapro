import { useState, useEffect } from 'react'
import homeHero from './assets/home-hero.png'
import Header from './components/layout/Header'
import LoginForm from './components/auth/LoginForm'
import Sidebar from './components/layout/Sidebar'
import UserTable from './components/users/UserTable'
import UserModal from './components/users/UserModal'
import DataTable from './components/common/DataTable'
import CustomerTable from './components/customers/CustomerTable'
import CustomerModal from './components/customers/CustomerModal'
import SupplierTable from './components/suppliers/SupplierTable'
import SupplierModal from './components/suppliers/SupplierModal'
import ContractListPage from './components/contracts/ContractListPage'
import ContractManagementPage from './pages/ContractManagementPage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [activeMenu, setActiveMenu] = useState('Trang chủ')
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal state for users
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)

  // Modal state for customers
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState(null)

  // Dropdown data
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [managers, setManagers] = useState([])

  // Customer data
  const [customers, setCustomers] = useState([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')

  // Supplier data
  const [suppliers, setSuppliers] = useState([])
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState(null)

  // Contract data
  const [contracts, setContracts] = useState([])
  const [contractSearchTerm, setContractSearchTerm] = useState('')

  // Selected contract ID for detail view
  const [selectedContractId, setSelectedContractId] = useState(null)

  const getBaseUrl = () => {
    return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/users`)
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  async function loadDropdowns() {
    try {
      const depRes = await fetch(`${getBaseUrl()}/api/departments`)
      const posRes = await fetch(`${getBaseUrl()}/api/positions`)
      const manRes = await fetch(`${getBaseUrl()}/api/managers`)
      setDepartments(await depRes.json())
      setPositions(await posRes.json())
      setManagers(await manRes.json())
    } catch (err) {
      console.error('Failed to load dropdowns:', err)
    }
  }

  async function loadCustomers() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/customers`)
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  async function loadSuppliers() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/suppliers`)
      const data = await res.json()
      setSuppliers(data)
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }

  async function handleSaveSupplier(formData, isEdit) {
    try {
      const url    = isEdit ? `${getBaseUrl()}/api/suppliers/${editingSupplierId}` : `${getBaseUrl()}/api/suppliers`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data   = await res.json()
      if (!res.ok) { alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!')); return }
      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadSuppliers()
      setShowAddSupplierModal(false)
      setShowEditSupplierModal(false)
      setEditingSupplierId(null)
    } catch (err) {
      console.error(err)
      alert('Có lỗi xảy ra.')
    }
  }

  function handleEditSupplier(supplier) {
    setEditingSupplierId(supplier.id)
    setShowEditSupplierModal(true)
  }

  async function loadContracts() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/contracts`)
      const data = await res.json()
      setContracts(data)
    } catch (err) {
      console.error('Failed to load contracts:', err)
    }
  }

  async function checkEmailExists(emailToCheck, callback) {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      callback(false)
      return
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/users/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      })
      const data = await res.json()
      callback(data.exists)
    } catch (err) {
      console.error('Lỗi kiểm tra email:', err)
      callback(false)
    }
  }

  async function checkUsernameExists(usernameToCheck, callback) {
    if (!usernameToCheck) {
      callback(false)
      return
    }
    try {
      const res = await fetch(`${getBaseUrl()}/api/users/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToCheck }),
      })
      const data = await res.json()
      callback(data.exists)
    } catch (error) {
      console.error('Lỗi kiểm tra username:', error)
      callback(false)
    }
  }

  async function checkEmployeeCodeExists(codeToCheck, callback) {
    if (!codeToCheck) {
      callback(false)
      return
    }
    try {
      const res = await fetch(`${getBaseUrl()}/api/users/check-employee-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: codeToCheck }),
      })
      const data = await res.json()
      callback(data.exists)
    } catch (error) {
      console.error('Lỗi kiểm tra mã NV:', error)
      callback(false)
    }
  }

  function handleLogin(e, email, password) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }

    ;(async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error ?? 'Đăng nhập thất bại.')
          return
        }

        setUser({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          positions:     data.positions     || [],
          position_code: data.position_code  || null,
          position_name: data.position_name  || null
        })
        localStorage.setItem('userId', data.id)
        //setView('home')
        setCurrentPage('home')
        setActiveMenu('Trang chủ')
      } catch {
        setError('Không kết nối được server.')
      }
    })()
  }

  function handleLogout() {
    localStorage.removeItem('userId')
    setUser(null)
    setError('')
  }

  function handleNavigate(menu, viewName) {
    setActiveMenu(menu)
    
    if (menu === 'Trang chủ') {
      setCurrentPage('home')
    } else if (menu === 'Hợp đồng bán') {
      setCurrentPage('contracts')
    } else if (menu === 'Tra cứu bảo hành') {
      setCurrentPage('documents')
    } else if (menu === 'Giao ban tuần') {
      setCurrentPage('tasks')
    } else if (menu === 'Quản trị hệ thống') {
      setCurrentPage(user ? 'admin' : 'login')
      setActiveMenu(user ? 'Quản lý người dùng' : 'Quản trị hệ thống')
    } else if (menu === 'Quản lý người dùng' || menu === 'departments' || menu === 'positions' || menu === 'customers') {
      setCurrentPage('admin')
    }
  }

  async function handleSaveUser(formData, isEdit) {
    try {
      const url = isEdit 
        ? `${getBaseUrl()}/api/users/${editingUserId}`
        : `${getBaseUrl()}/api/users`
      
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!'))
        return
      }

      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadUsers()
      setShowAddModal(false)
      setShowEditModal(false)
      setEditingUserId(null)
    } catch (err) {
      console.error(err)
      alert('Có lỗi xảy ra.')
    }
  }

  function handleEdit(user) {
    setEditingUserId(user.id)
    setShowEditModal(true)
  }

  function handleEditCustomer(customer) {
    setEditingCustomerId(customer.id)
    setShowEditCustomerModal(true)
  }

  async function handleSaveCustomer(formData, isEdit) {
    try {
      const url = isEdit 
        ? `${getBaseUrl()}/api/customers/${editingCustomerId}`
        : `${getBaseUrl()}/api/customers`
      
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || (isEdit ? 'Cập nhật thất bại!' : 'Thêm mới thất bại!'))
        return
      }

      alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      await loadCustomers()
      setShowAddCustomerModal(false)
      setShowEditCustomerModal(false)
      setEditingCustomerId(null)
    } catch (err) {
      console.error(err)
      alert('Có lỗi xảy ra.')
    }
  }

  useEffect(() => {
    loadUsers()
    loadDropdowns()
    loadCustomers()
    loadSuppliers()
    loadContracts()

  }, [])

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) return

    ;(async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/me/${userId}`)
        if (!res.ok) {
          localStorage.removeItem('userId')
          return
        }
        const data = await res.json()
        setUser({
          ...data,
          position_code: data.positions?.[0]?.code  || null,
          position_name: data.positions?.map(p => p.name).join(', ') || null,
        })
      } catch {
        localStorage.removeItem('userId')
      }
    })()
  }, [])

  return (
    <div className="shell">
      <Header 
        user={user}
        activeMenu={activeMenu}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {currentPage === 'contractDetail' ? (
        <main className="page admin-page">
          <div className="contract-management-layout">
            <ContractManagementPage selectedContractId={selectedContractId} />
          </div>
        </main>
      ) : currentPage === 'login' ? (
        <main className="page">
          <LoginForm onLogin={handleLogin} error={error} />
        </main>
      ) : activeMenu === 'Trang chủ' || activeMenu === 'Tra cứu bảo hành' || activeMenu === 'Giao ban tuần' ? (
        <main className="page page--home">
          <div className="home-hero">
            <img className="home-hero-img" src={homeHero} alt="" />
          </div>
        </main>
      ) : activeMenu === 'Hợp đồng bán' ? (
        <main className="page admin-page">
          <div className="admin-layout">
            <section className="content-area">
              <ContractListPage 
                contracts={contracts}
                searchTerm={contractSearchTerm}
                onManage={(c) => {
                  setSelectedContractId(c.id)
                  setCurrentPage('contractDetail')
                }}
                onLoadContracts={loadContracts}
                currentUser={user}
                users={users}
                customers={customers}
              />
            </section>
          </div>
        </main>
      ) : (
        <main className="page admin-page">
          <div className="admin-layout">
            <Sidebar activeMenu={activeMenu} onNavigate={setActiveMenu} />

            <section className="content-area">
              {activeMenu === 'Quản lý người dùng' && (
                <>
                  <h2 className="section-title">QUẢN LÝ NGƯỜI DÙNG</h2>
                  <div style={{ 
                    marginBottom: '15px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    {user?.role == 1 && (
                      <button className="add-btn" onClick={() => setShowAddModal(true)}>
                        Thêm người dùng
                      </button>
                    )}
                    <div style={{ flex: 1, maxWidth: '300px' }}>
                      <input
                        type="text"
                        placeholder="🔍 Tìm kiếm (Tên, Email, SĐT...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <UserTable 
                    users={users}
                    searchTerm={searchTerm}
                    userRole={user?.role}
                    onEdit={handleEdit}
                  />

                  <UserModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSave={handleSaveUser}
                    departments={departments}
                    positions={positions}
                    managers={managers}
                    checkEmailExists={checkEmailExists}
                    checkUsernameExists={checkUsernameExists}
                    checkEmployeeCodeExists={checkEmployeeCodeExists}
                  />

                  <UserModal
                    isOpen={showEditModal}
                    onClose={() => { setShowEditModal(false); setEditingUserId(null) }}
                    onSave={handleSaveUser}
                    user={users.find(u => u.id === editingUserId)}
                    departments={departments}
                    positions={positions}
                    managers={managers}
                    checkEmailExists={checkEmailExists}
                    checkUsernameExists={checkUsernameExists}
                    checkEmployeeCodeExists={checkEmployeeCodeExists}
                  />
                </>
              )}

              {activeMenu === "departments" && (
                <DataTable
                  title="QUẢN LÝ PHÒNG BAN"
                  columns={[
                    { header: 'Mã phòng ban', field: 'code' },
                    { header: 'Tên phòng ban', field: 'name' }
                  ]}
                  data={departments}
                />
              )}

              {activeMenu === "positions" && (
                <DataTable
                  title="QUẢN LÝ VỊ TRÍ"
                  columns={[
                    { header: 'Mã vị trí', field: 'code' },
                    { header: 'Tên vị trí', field: 'name' }
                  ]}
                  data={positions}
                />
              )}

              {activeMenu === "customers" && (
                <>
                  <h2 className="section-title">QUẢN LÝ KHÁCH HÀNG</h2>
                  <div className="content-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {user?.role == 1 && (
                      <button className="add-btn" onClick={() => setShowAddCustomerModal(true)}>
                        Thêm khách hàng
                      </button>
                    )}
                    <div style={{ maxWidth: '300px' }}>
                      <input
                        type="text"
                        placeholder="🔍 Tìm kiếm (Tên, Mã, MST, SĐT...)"
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div className="content-scrollable">
                    <CustomerTable 
                      customers={customers}
                      searchTerm={customerSearchTerm}
                      userRole={user?.role}
                      onEdit={handleEditCustomer}
                    />
                  </div>

                  <CustomerModal
                    isOpen={showAddCustomerModal}
                    onClose={() => setShowAddCustomerModal(false)}
                    onSave={handleSaveCustomer}
                  />

                  <CustomerModal
                    isOpen={showEditCustomerModal}
                    onClose={() => { setShowEditCustomerModal(false); setEditingCustomerId(null) }}
                    onSave={handleSaveCustomer}
                    customer={customers.find(c => c.id === editingCustomerId)}
                  />
                </>
              )}

              {activeMenu === "suppliers" && (
                <>
                  <h2 className="section-title">QUẢN LÝ NHÀ CUNG CẤP</h2>
                  <div className="content-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {user?.role == 1 && (
                      <button className="add-btn" onClick={() => setShowAddSupplierModal(true)}>
                        Thêm nhà cung cấp
                      </button>
                    )}
                    <div style={{ maxWidth: '300px' }}>
                      <input
                        type="text"
                        placeholder="🔍 Tìm kiếm (Tên, Mã, MST, SĐT...)"
                        value={supplierSearchTerm}
                        onChange={e => setSupplierSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div className="content-scrollable">
                    <SupplierTable
                      suppliers={suppliers}
                      searchTerm={supplierSearchTerm}
                      userRole={user?.role}
                      onEdit={handleEditSupplier}
                    />
                  </div>

                  <SupplierModal
                    isOpen={showAddSupplierModal}
                    onClose={() => setShowAddSupplierModal(false)}
                    onSave={handleSaveSupplier}
                  />

                  <SupplierModal
                    isOpen={showEditSupplierModal}
                    onClose={() => { setShowEditSupplierModal(false); setEditingSupplierId(null) }}
                    onSave={handleSaveSupplier}
                    supplier={suppliers.find(s => s.id === editingSupplierId)}
                  />
                </>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  )
}

export default App
