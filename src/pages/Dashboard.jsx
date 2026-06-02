import './Dashboard.css'

const STATUS_MAP = {
  Active:    { label: 'Đang thực hiện', cls: 'status-active' },
  Completed: { label: 'Hoàn thành',     cls: 'status-completed' },
  Pending:   { label: 'Chờ xử lý',      cls: 'status-pending' },
  Cancelled: { label: 'Hủy bỏ',         cls: 'status-cancelled' },
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="dash-stat-card" style={{ borderTopColor: color }}>
      <div className="dash-stat-icon" style={{ color }}>{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  )
}

export default function Dashboard({ user, contracts = [], customers = [], users = [] }) {
  const active    = contracts.filter(c => c.status === 'Active').length
  const completed = contracts.filter(c => c.status === 'Completed').length
  const pending   = contracts.filter(c => c.status === 'Pending').length

  const recent = [...contracts]
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .slice(0, 8)

  return (
    <div className="dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Tổng quan hệ thống</h1>
          <p className="dash-subtitle">Xin chào, <strong>{user?.full_name || user?.email}</strong> — {user?.department_name}</p>
        </div>
      </div>

      <div className="dash-stats">
        <StatCard label="Tổng hợp đồng"     value={contracts.length} color="#2f6b3a" icon="📋" />
        <StatCard label="Đang thực hiện"    value={active}           color="#2563eb" icon="⚡" />
        <StatCard label="Hoàn thành"        value={completed}        color="#16a34a" icon="✅" />
        <StatCard label="Chờ xử lý"         value={pending}          color="#d97706" icon="⏳" />
        <StatCard label="Chủ đầu tư"        value={customers.length} color="#7c3aed" icon="🏢" />
        <StatCard label="Nhân sự"           value={users.length}     color="#0891b2" icon="👥" />
      </div>

      <div className="dash-section">
        <h2 className="dash-section-title">Hợp đồng gần đây</h2>
        {recent.length === 0 ? (
          <p className="dash-empty">Chưa có dữ liệu hợp đồng.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Số HĐ</th>
                  <th>Dự án</th>
                  <th>Chủ đầu tư</th>
                  <th>PM</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => {
                  const s = STATUS_MAP[c.status] || { label: c.status, cls: '' }
                  return (
                    <tr key={c.id}>
                      <td className="dash-td-mono">{c.contract_no || '—'}</td>
                      <td>{c.project_name || '—'}</td>
                      <td>{c.customer_name || '—'}</td>
                      <td>{c.pm_name || '—'}</td>
                      <td><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
