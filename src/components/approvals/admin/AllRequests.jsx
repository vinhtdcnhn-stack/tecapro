import { useState, useEffect, useCallback, useMemo } from 'react'
import { API } from '../../../config/api'
import { useAuth } from '../../../context/AuthContext'
import useIsMobile from '../../contracts/useIsMobile'
import RequestDetail from '../RequestDetail'
import FormTypeFilter, { useFormTypeFilter } from '../FormTypeFilter'
import { statusInfo, REQUEST_STATUS } from '../approvalUtils'

const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

function StatusBadge({ s }) {
  const info = statusInfo(s)
  return <span className={`status-badge ${info.cls}`}>{info.label}</span>
}

// Trạng thái có thể xuất hiện ở danh sách (bỏ nháp — nháp riêng tư, không liệt kê).
const STATUS_OPTS = Object.entries(REQUEST_STATUS).filter(([k]) => k !== 'draft')

// Tab quản trị: TẤT CẢ đề xuất đã gửi, lọc nhiều chiều, bấm để mở chi tiết
// (trong đó admin xóa/khôi phục được). Đơn đã xóa hiển thị gạch ngang.
export default function AllRequests() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState([])
  const [openId, setOpenId] = useState(null)
  const [status, setStatus] = useState('')
  const [dept, setDept] = useState('')
  const [vis, setVis] = useState('') // '' tất cả | 'active' còn hiệu lực | 'deleted' đã xóa
  const [q, setQ] = useState('')
  const { formId, setFormId, options, filtered: byForm } = useFormTypeFilter(rows)

  const load = useCallback(() => {
    fetch(`${API}/approvals/requests/all`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  // Danh sách phòng ban (suy từ dữ liệu) để lọc.
  const deptOptions = useMemo(() => {
    const s = new Set()
    for (const r of rows) if (r.requester_dept) s.add(r.requester_dept)
    return [...s].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [rows])

  // Áp các bộ lọc còn lại trên kết quả đã lọc theo loại đơn.
  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return byForm.filter(r => {
      if (status && r.status !== status) return false
      if (dept && r.requester_dept !== dept) return false
      if (vis === 'deleted' && !r.deleted_at) return false
      if (vis === 'active' && r.deleted_at) return false
      if (kw && !(`${r.title || ''} ${r.requester_name || ''}`.toLowerCase().includes(kw))) return false
      return true
    })
  }, [byForm, status, dept, vis, q])

  return (
    <div>
      <div className="ab-section-head">
        <h2 className="section-title" style={{ margin: 0 }}>TẤT CẢ ĐỀ XUẤT</h2>
      </div>

      <div className="ar-filter-bar">
        <FormTypeFilter value={formId} onChange={setFormId} options={options} alwaysShow />
        <label className="ar-filter"><span>Trạng thái:</span>
          <select className="ab-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {STATUS_OPTS.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        {deptOptions.length > 0 && (
          <label className="ar-filter"><span>Phòng ban:</span>
            <select className="ab-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">Tất cả</option>
              {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        <label className="ar-filter"><span>Tình trạng:</span>
          <select className="ab-input" value={vis} onChange={e => setVis(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="active">Còn hiệu lực</option>
            <option value="deleted">Đã xóa</option>
          </select>
        </label>
        <input
          className="ab-input ar-search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Tìm tiêu đề / người gửi…"
        />
      </div>

      {rows.length === 0 && <p className="approval-empty">Chưa có đề xuất nào.</p>}
      {rows.length > 0 && visible.length === 0 && <p className="approval-empty">Không có đề xuất khớp bộ lọc.</p>}

      {!isMobile && visible.length > 0 && (
        <table className="data-table ar-table">
          <thead>
            <tr><th>Loại đơn</th><th>Tiêu đề</th><th>Người gửi</th><th>Phòng ban</th><th>Trạng thái</th><th>Bước hiện tại</th><th>Ngày tạo</th></tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id} className="ar-row-click" onClick={() => setOpenId(r.id)}>
                <td>{r.form_icon ? `${r.form_icon} ` : ''}{r.form_name}</td>
                <td className={r.deleted_at ? 'ar-deleted' : ''}>{r.title}</td>
                <td>{r.requester_name}</td>
                <td>{r.requester_dept || ''}</td>
                <td><StatusBadge s={r.status} />{r.deleted_at && <span className="status-badge status-cancelled" style={{ marginLeft: 4 }}>Đã xóa</span>}</td>
                <td>{r.status === 'pending' ? (r.current_step_name || '') : ''}</td>
                <td>{fmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isMobile && visible.map(r => (
        <div key={r.id} className="ar-card" onClick={() => setOpenId(r.id)}>
          <div className="ar-card-top">
            <span className={`ar-card-title${r.deleted_at ? ' ar-deleted' : ''}`}>{r.form_icon ? `${r.form_icon} ` : ''}{r.title}</span>
            <StatusBadge s={r.status} />
          </div>
          <div className="ar-card-meta">
            <span>{r.requester_name}{r.requester_dept ? ` · ${r.requester_dept}` : ''}</span>
            <span>{fmt(r.created_at)}</span>
          </div>
        </div>
      ))}

      {openId && (
        <RequestDetail
          requestId={openId}
          currentUserId={user.id}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
