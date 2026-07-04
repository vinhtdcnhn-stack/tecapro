import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTenders, qk } from '../../lib/queries'
import { prefetchTender } from '../../lib/idlePrefetch'
import { useCopyMenu } from '../common/useCopyMenu'
import useIsMobile from '../contracts/useIsMobile'
import TenderModal from './TenderModal'
import { exportTenders } from './tenderExport'
import {
  FIELDS, RESULTS, WORKFLOW, BID_STATUSES, statusColor, resultColor, bidStatusColor,
  fmtAmount, fmtDate, daysUntil,
} from './tenderUtils'

// Bảng danh sách gói thầu + bộ lọc + tạo mới + xuất Excel.
//   mode='all'   → mọi gói (Danh sách gói)
//   mode='my'    → gói mình phụ trách (Việc của tôi)
// Trưởng phòng (isHead) phân công người làm thầu/AM ngay trong form tạo/sửa.
export default function TenderList({ mode = 'all', canCreate = true, isHead = false, members = [] }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)   // null | { } (tender being edited) | 'new'
  const [q, setQ] = useState('')
  const [field, setField] = useState('')
  const [status, setStatus] = useState('')
  const [bidStatus, setBidStatus] = useState('')
  const [result, setResult] = useState('')

  // Danh sách gói thầu qua TanStack Query (cache theo mode all/my): render ngay từ cache,
  // làm mới ngầm. Sau khi thêm/sửa trong modal thì invalidate để tải lại.
  const { data: rows = [], isLoading: loading } = useTenders(mode)
  const load = () => queryClient.invalidateQueries({ queryKey: qk.tenders(mode) })

  const filtered = useMemo(() => {
    let r = rows
    if (field) r = r.filter(t => t.field === field)
    if (status) r = r.filter(t => t.workflow_status === status)
    if (bidStatus) r = r.filter(t => (t.bid_status || '') === bidStatus)
    if (result) r = r.filter(t => (t.result || '') === result)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      r = r.filter(t => [t.package_name, t.package_code, t.investor, t.bid_maker_name, t.am_name]
        .some(v => String(v || '').toLowerCase().includes(s)))
    }
    return r
  }, [rows, field, status, bidStatus, result, q])

  const { getRowProps, copyMenu } = useCopyMenu(
    (t) => `Gói thầu: ${t.package_name}\nChủ đầu tư: ${t.investor || '—'}\nDự toán: ${fmtAmount(t.estimate, t.currency_code) || '—'}`
      + `\nNgày nộp: ${fmtDate(t.submit_date) || '—'}\nTrạng thái: ${t.workflow_status}`,
    (t) => t.package_name,
    (t) => `/cong-viec/dau-thau/goi/${t.id}`,
  )

  const open = (t) => navigate(`/cong-viec/dau-thau/goi/${t.id}`)
  // Rê chuột/chạm vào hàng: nạp sẵn chi tiết gói + chunk trang chi tiết → mở gần như tức thì.
  const prefetchDetail = (id) => { prefetchTender(id); import('../../pages/TenderDetailPage') }

  return (
    <div className="tender-list">
      <div className="tender-toolbar">
        <input
          className="tender-search" placeholder="Tìm tên gói / mã / chủ đầu tư / người làm…"
          value={q} onChange={e => setQ(e.target.value)}
        />
        <select value={field} onChange={e => setField(e.target.value)}>
          <option value="">Lĩnh vực: tất cả</option>
          {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tình trạng: tất cả</option>
          {WORKFLOW.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={bidStatus} onChange={e => setBidStatus(e.target.value)}>
          <option value="">Trạng thái: tất cả</option>
          {BID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={result} onChange={e => setResult(e.target.value)}>
          <option value="">Kết quả: tất cả</option>
          {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="tender-toolbar-spacer" />
        <button className="btn-secondary" onClick={() => exportTenders(filtered)} disabled={!filtered.length}>
          Xuất Excel
        </button>
        {canCreate && (
          <button className="btn-primary" onClick={() => setModal('new')}>+ Thêm gói thầu</button>
        )}
      </div>

      {loading ? (
        <p className="dash-empty">Đang tải…</p>
      ) : !filtered.length ? (
        <p className="dash-empty">Chưa có gói thầu nào.</p>
      ) : isMobile ? (
        <div className="mcards">
          {filtered.map((t, i) => {
            const sc = statusColor(t.workflow_status)
            const bc = bidStatusColor(t.bid_status)
            const rc = resultColor(t.result)
            const d = daysUntil(t.submit_date)
            const due = d != null && d <= 3 && !t.result
            return (
              <div key={t.id} {...getRowProps(t)} className="mcard" onClick={() => open(t)}>
                <div className="mcard-head">
                  <span className="mcard-title">{i + 1}. {t.package_name}{t.package_code ? ` (${t.package_code})` : ''}</span>
                  {t.estimate != null && <span className="mcard-amount">{fmtAmount(t.estimate, t.currency_code)}</span>}
                </div>
                <div className="mcard-meta">
                  {t.investor && <span>{t.investor}</span>}
                  {t.submit_date && <span className={due ? 'tender-due' : ''}>Nộp: {fmtDate(t.submit_date)}{due ? ' ⚠' : ''}</span>}
                  {t.field && <span>{t.field}</span>}
                  <span>Người làm: {t.bid_maker_name || 'Chưa giao'}</span>
                  {t.am_name && <span>AM: {t.am_name}</span>}
                </div>
                <div className="mcard-meta">
                  <span className="tender-badge" style={{ background: sc.bg, color: sc.fg }}>{t.workflow_status}</span>
                  {t.bid_status && <span className="tender-badge" style={{ background: bc.bg, color: bc.fg }}>{t.bid_status}</span>}
                  {rc && <span className="tender-badge" style={{ background: rc.bg, color: rc.fg }}>{t.result}</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="tender-table-wrap">
          <table className="tender-table">
            <thead>
              <tr>
                <th>STT</th><th>Tên gói thầu</th><th>Chủ đầu tư</th><th className="num">Dự toán</th>
                <th>Ngày nộp</th><th>Lĩnh vực</th><th>Người làm thầu</th><th>AM</th>
                <th>Trạng thái</th><th>Tình trạng</th><th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const sc = statusColor(t.workflow_status)
                const bc = bidStatusColor(t.bid_status)
                const rc = resultColor(t.result)
                const d = daysUntil(t.submit_date)
                const due = d != null && d <= 3 && !t.result
                return (
                  <tr key={t.id} {...getRowProps(t)} onMouseEnter={() => prefetchDetail(t.id)} onClick={() => open(t)} className="tender-row">
                    <td>{i + 1}</td>
                    <td className="tender-name">{t.package_name}{t.package_code ? ` (${t.package_code})` : ''}</td>
                    <td>{t.investor || ''}</td>
                    <td className="num">{fmtAmount(t.estimate, t.currency_code)}</td>
                    <td className={due ? 'tender-due' : ''} title={due ? `Còn ${d} ngày` : ''}>
                      {fmtDate(t.submit_date)}{due ? ' ⚠' : ''}
                    </td>
                    <td>{t.field || ''}</td>
                    <td>{t.bid_maker_name || <span className="tender-muted">Chưa giao</span>}</td>
                    <td>{t.am_name || ''}</td>
                    <td>{t.bid_status ? <span className="tender-badge" style={{ background: bc.bg, color: bc.fg }}>{t.bid_status}</span> : ''}</td>
                    <td><span className="tender-badge" style={{ background: sc.bg, color: sc.fg }}>{t.workflow_status}</span></td>
                    <td>{rc ? <span className="tender-badge" style={{ background: rc.bg, color: rc.fg }}>{t.result}</span> : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {copyMenu}

      {modal && (
        <TenderModal
          tender={modal === 'new' ? null : modal}
          isHead={isHead}
          members={members}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
