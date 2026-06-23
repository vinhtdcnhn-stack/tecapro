import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API } from '../config/api'
import ContractDocumentsTab from '../components/contracts/ContractDocumentsTab'
import { ContractPermProvider } from '../context/ContractPermContext'
import { statusColor, fmtDate } from '../components/tender/tenderUtils'
import '../components/tender/Tender.css'

// Trang "Việc đấu thầu của tôi" — cho người được giao đầu việc checklist nhưng KHÔNG
// thuộc Ban Đấu thầu (không mở được module). Bố cục giống trang chi tiết gói thầu:
// thẻ thông tin việc + đổi trạng thái, rồi 2 tab dùng trình quản lý thư mục/tệp:
//   • Tệp sản phẩm — đầy đủ (tạo thư mục, upload tệp/thư mục, xoá) khoá theo đầu việc.
//   • Hồ sơ mời thầu — CHỈ ĐỌC (xem trước + tải về), không upload/xoá.
// Mọi quyền gác server-side theo người được giao của đúng đầu việc/tệp.
const STATUSES = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

export default function MyTenderTaskPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('docs')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/tender/my-task/${itemId}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || (res.status === 403
          ? 'Bạn không có quyền xem việc này.' : 'Không tải được công việc.'))
      }
      const data = await res.json()
      setItem(data.item)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [itemId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(() => { load() }, [load])

  async function changeStatus(status) {
    if (!item || status === item.status) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/tender/checklist/${itemId}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Không đổi được trạng thái.') }
      setItem(prev => ({ ...prev, status }))
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <main className="page admin-page"><p className="dash-empty">Đang tải công việc…</p></main>
  if (error) {
    return (
      <main className="page admin-page">
        <button className="btn-link" onClick={() => navigate(-1)}>← Quay lại</button>
        <p className="tender-error" style={{ marginTop: 12 }}>{error}</p>
      </main>
    )
  }

  const sc = statusColor(item.status)

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <section className="content-area tender-detail mtt">

          <div className="tender-detail-head">
            <button className="btn-link" onClick={() => navigate(-1)}>← Quay lại</button>
            <h2 className="section-title">
              {item.package_name}{item.package_code ? ` (${item.package_code})` : ''}
            </h2>
          </div>

          {/* Thẻ thông tin đầu việc + đổi trạng thái */}
          <div className="mtt-card">
            <div className="mtt-card-top">
              <div className="mtt-card-titles">
                <h3 className="mtt-task-title">{item.title}</h3>
                {item.investor && <div className="tender-muted">Chủ đầu tư: {item.investor}</div>}
              </div>
              <span className="tender-status-badge" style={{ background: sc.bg, color: sc.fg }}>{item.status}</span>
            </div>

            {item.description && <p className="mtt-desc">{item.description}</p>}

            <div className="mtt-meta">
              {item.department_name && <span>Phòng: <strong>{item.department_name}</strong></span>}
              <span>Người phụ trách: <strong>{item.assignee_name || '—'}</strong></span>
              {item.due_date && <span>Hạn: <strong>{fmtDate(item.due_date)}</strong></span>}
            </div>

            <div className="mtt-status-pick">
              <span className="tender-muted">Cập nhật trạng thái:</span>
              {STATUSES.map(s => (
                <button
                  key={s}
                  className={`mtt-status-btn ${s === item.status ? 'active' : ''}`}
                  disabled={saving || s === item.status}
                  onClick={() => changeStatus(s)}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Tabs: tệp sản phẩm (sửa được) / hồ sơ mời thầu (chỉ đọc) */}
          <div className="tender-tabs">
            <button className={`tender-tab${tab === 'docs' ? ' active' : ''}`} onClick={() => setTab('docs')}>
              Tệp sản phẩm
            </button>
            <button className={`tender-tab${tab === 'invitation' ? ' active' : ''}`} onClick={() => setTab('invitation')}>
              Hồ sơ mời thầu
            </button>
          </div>

          <div className="tender-tab-body">
            {tab === 'docs' && (
              <ContractPermProvider canEdit={true}>
                <ContractDocumentsTab basePath={`tender/my-task/${itemId}/docs`} allowRootUpload />
              </ContractPermProvider>
            )}
            {tab === 'invitation' && (
              <ContractPermProvider canEdit={false}>
                <ContractDocumentsTab basePath={`tender/my-task/${itemId}/invitation`} allowRootUpload />
              </ContractPermProvider>
            )}
          </div>

        </section>
      </div>
    </main>
  )
}
