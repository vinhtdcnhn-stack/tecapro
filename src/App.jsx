import { useEffect, useState } from 'react'
import tecaproLogo from './assets/tecapro-logo.png'
import homeHero from './assets/home-hero.png'
import './App.css'


function App() {
  const [view, setView] = useState('home')
  const [activeMenu, setActiveMenu] = useState('Trang chủ')
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmployeeCode, setNewEmployeeCode] = useState('')
 const [departments, setDepartments] = useState([])
const [positions, setPositions] = useState([])
const [managers, setManagers] = useState([])

const [newDepartmentId, setNewDepartmentId] = useState('')
const [newPositionId, setNewPositionId] = useState('')
const [newManagerId, setNewManagerId] = useState('')
const [newRole, setNewRole] = useState('2')


  const menus = [
    'Trang chủ',
    'Hợp đồng bán',
    'Tài liệu',
    'Các tác vụ',
    'Quản trị hệ thống',
  ]

async function loadUsers() {
  const base =
    (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(
      /\/$/,
      '',
    )

  const res = await fetch(`${base}/api/users`)
  const data = await res.json()

  setUsers(data)
}

async function loadDropdowns() {

  const depRes =
    await fetch('http://localhost:5174/api/departments')

  const posRes =
    await fetch('http://localhost:5174/api/positions')

  const manRes =
    await fetch('http://localhost:5174/api/managers')

  setDepartments(await depRes.json())
  setPositions(await posRes.json())
  setManagers(await manRes.json())
}

  function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }

    ;(async () => {
      try {
        const base =
          (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(
            /\/$/,
            '',
          )
        const res = await fetch(`${base}/api/auth/login`, {
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
            role: data.role
          })
          localStorage.setItem(
            'userId',
            data.id
          )
          
        setPassword('')
        setView('home')
        setActiveMenu('Trang chủ')
      } catch {
        setError('Không kết nối được server.')
      }
    })()
  }

  function handleLogout() {
    localStorage.removeItem('userId')
    setUser(null)
    setEmail('')
    setPassword('')
    setError('')
  }

  useEffect(() => {
  loadUsers()
  loadDropdowns()
}, [])

useEffect(() => {

  const userId =
    localStorage.getItem('userId')

  if (!userId) {
    return
  }

  ;(async () => {

    try {

      const res = await fetch(
        `http://localhost:5174/api/me/${userId}`
      )

      if (!res.ok) {

        localStorage.removeItem('userId')

        return
      }

      const data = await res.json()

      setUser(data)

    } catch {

      localStorage.removeItem('userId')
    }

  })()

}, [])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="brand"
            onClick={() => {
              setActiveMenu('Trang chủ')
              setView('home')
            }}
            aria-label="Trang chủ"
          >
            <img className="brand-logo" src={tecaproLogo} alt="TECAPRO" />
          </button>

          <nav className="menu" aria-label="Chính">
            {menus.map((m) => (
              <button
                key={m}
                type="button"
                className={`menu-item ${activeMenu === m ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveMenu(m)
                  if (m === 'Quản trị hệ thống') {
                    setError('')
                    setView(user ? 'home' : 'login')
                  } else {
                    setView('home')
                  }
                }}
              >
                {m}
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            {user ? (
              <>
                <span className="user-pill" title={user.email}>
                  {user.full_name}
                </span>
                <button type="button" className="topbar-btn" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                type="button"
                className="topbar-btn"
                onClick={() => {
                  setActiveMenu('Quản trị hệ thống')
                  setError('')
                  setView('login')
                }}
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>
      {view === 'login' ? (
  <main className="page">
      

<div className="content">

  <div className="login-header">
    <p className="eyebrow">TECAPRO</p>

    <h2 className="login-title">
      ĐĂNG NHẬP
    </h2>

    <p className="subtitle login-subtitle">
      Hệ thống quản lý nội bộ
    </p>
  </div>

  <form className="login-form" onSubmit={handleLogin}>

    <div className="field">
      <label className="field-label">
        Email
      </label>

      <input
        type="email"
        className="field-input"
        placeholder="Nhập email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>

    <div className="field">
      <label className="field-label">
        Mật khẩu
      </label>

      <input
        type="password"
        className="field-input"
        placeholder="Nhập mật khẩu"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </div>

    {error && (
      <p className="form-error">
        {error}
      </p>
    )}

    <button
      type="submit"
      className="btn btn--full"
    >
      Đăng nhập
    </button>

  </form>

</div>

  </main>
) : activeMenu === 'Trang chủ' ? (
  <main className="page page--home">
    <div className="home-hero">
      <img className="home-hero-img" src={homeHero} alt="" />
    </div>
  </main>
) : (
  <main className="page admin-page">
    <div className="admin-layout">
      <aside className="sidebar">
        <button
          className={`sidebar-btn ${
            activeMenu === 'Quản lý người dùng' ? 'active' : ''
          }`}
          onClick={() => setActiveMenu('Quản lý người dùng')}
        >
          QUẢN LÝ NGƯỜI DÙNG
        </button>

        <button
          className={`sidebar-btn ${
            activeMenu === "departments" ? "active" : ""
          }`}
          onClick={() => setActiveMenu("departments")}
        >
          QUẢN LÝ PHÒNG BAN
        </button>

        <button
          className={`sidebar-btn ${
            activeMenu === "positions" ? "active" : ""
          }`}
          onClick={() => setActiveMenu("positions")}
        >
          QUẢN LÝ VỊ TRÍ
        </button>


      </aside>

      <section className="content-area">
        {activeMenu === 'Quản lý người dùng' && (
          <>
            <h2 className="section-title">QUẢN LÝ NGƯỜI DÙNG</h2>
            {user?.role == 1 && (
              <button className="add-btn"
              onClick={() => setShowAddModal(true)}
              >
                Thêm người dùng
              </button>
            )}

            <table className="user-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò</th>
                  <th>Hành động</th>
                </tr>
              </thead>


              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td>{u.role}</td>
                    <td> {user?.role == 1 && ( <button className="edit-btn"> Sửa </button> )} </td>
                  </tr>
                ))}
              </tbody>
            </table>
              {showAddModal && (
                <div className="modal-overlay">

                  <div className="modal">

                    <div className="modal-header">
                      <h2>THÊM NGƯỜI DÙNG</h2>

                      <button
                        className="close-btn"
                        onClick={() => setShowAddModal(false)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="modal-body">

                      <div className="field">
                        <label>Tên đăng nhập</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label>Email</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label>Họ tên</label>

                        <input
                          type="text"
                          value={newFullName}
                          onChange={(e) =>
                            setNewFullName(e.target.value)
                          }
                        />
                      </div>

                      <div className="field">
                        <label>Mã nhân viên</label>

                        <input
                          type="text"
                          value={newEmployeeCode}
                          onChange={(e) =>
                            setNewEmployeeCode(e.target.value)
                          }
                        />
                      </div>

                      <div className="field">
                        <label>Phòng ban</label>

                        <select
                          value={newDepartmentId}
                          onChange={(e) =>
                            setNewDepartmentId(e.target.value)
                          }
                        >
                          <option value="">
                            Chọn phòng ban
                          </option>

                          {departments.map(dep => (
                            <option
                              key={dep.id}
                              value={dep.id}
                            >
                              {dep.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Vị trí</label>

                        <select
                          value={newPositionId}
                          onChange={(e) =>
                            setNewPositionId(e.target.value)
                          }
                        >
                          <option value="">
                            Chọn vị trí
                          </option>

                          {positions.map(pos => (
                            <option
                              key={pos.id}
                              value={pos.id}
                            >
                              {pos.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Quản lý trực tiếp</label>

                        <select
                          value={newManagerId}
                          onChange={(e) =>
                            setNewManagerId(e.target.value)
                          }
                        >
                          <option value="">
                            Chọn quản lý
                          </option>

                          {managers.map(manager => (
                            <option
                              key={manager.id}
                              value={manager.id}
                            >
                              {manager.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Vai trò</label>

                        <select
                          value={newRole}
                          onChange={(e) =>
                            setNewRole(e.target.value)
                          }
                        >
                          <option value="1">
                            Admin
                          </option>

                          <option value="2">
                            User
                          </option>
                        </select>
                      </div>

                      <div className="field">
                        <label>Số điện thoại</label>

                        <input
                          type="text"
                          value={newPhone}
                          onChange={(e) =>
                            setNewPhone(e.target.value)
                          }
                        />
                      </div>

                      <div className="field">
                        <label>Mật khẩu</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                    </div>

                    <div className="modal-footer">

                      <button
                        className="cancel-btn"
                        onClick={() => setShowAddModal(false)}
                      >
                        Hủy
                      </button>

                      <button
                          className="save-btn"
                          onClick={async () => {

                            const res = await fetch(
                              'http://localhost:5174/api/users',
                              {
                                method: 'POST',

                                headers: {
                                  'Content-Type': 'application/json'
                                },

                                body: JSON.stringify({
                                  username: newUsername,
                                  email: newEmail,
                                  password: newPassword,
                                  full_name: newFullName,
                                  phone: newPhone,
                                  employee_code: newEmployeeCode,
                                  department_id: newDepartmentId,
                                  position_id: newPositionId,
                                  manager_id: newManagerId,
                                  role: newRole
                                })
                              }
                            )

                            const data = await res.json()
                            console.log(data)
                            await loadUsers()

                            setShowAddModal(false)
                          }}
                        >
                          Lưu
                        </button>

                    </div>

                  </div>


                </div>
              )}

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
