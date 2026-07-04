import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchChanges, fetchOptions } from './auditApi'
import { tableLabel, fmtDateTime, OP_LABELS, OP_COLORS } from './auditLabels'
import AuditFilters from './AuditFilters'
import AuditDiffTable from './AuditDiffTable'
import useIsMobile from '../../contracts/useIsMobile'
import './audit.css'

const PAGE_SIZE = 50
const EMPTY_FILTERS = { q: '', tableName: '', actorId: '', op: '', from: '', to: '' }

// Trang admin "Nhật ký thay đổi": tra cứu lịch sử sửa đổi của module hợp đồng.
export default function AuditLogPage() {
  const isMobile = useIsMobile()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [options, setOptions] = useState({ tables: [], actors: [] })
  const [expanded, setExpanded] = useState(() => new Set())

  // Danh mục lọc — tải 1 lần.
  useEffect(() => {
    fetchOptions().then(setOptions).catch(() => {})
  }, [])

  // Debounce ô tìm để không gọi API mỗi phím.
  const debounceRef = useRef(null)
  const load = useCallback(async (f, p) => {
    setLoading(true); setError('')
    try {
      const data = await fetchChanges({ ...f, page: p, pageSize: PAGE_SIZE })
      setItems(prev => (p === 1 ? data.items : [...prev, ...data.items]))
      setTotal(data.total)
      setPage(p)
    } catch (e) {
      setError(e.message || 'Không tải được nhật ký thay đổi.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Mỗi lần đổi filter → tải lại từ trang 1 (debounce 300ms).
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { load(filters, 1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [filters, load])

  const onChange = (patch) => setFilters(f => ({ ...f, ...patch }))
  const onReset = () => setFilters(EMPTY_FILTERS)

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const hasMore = items.length < total

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 15 }}>
        <h2 className="section-title" style={{ margin: 0 }}>NHẬT KÝ THAY ĐỔI</h2>
        <span style={{ color: '#666', fontSize: 13 }}>{total} bản ghi</span>
      </div>

      <AuditFilters value={filters} onChange={onChange} options={options} onReset={onReset} />

      {error && <div style={{ color: '#c00', marginBottom: 10 }}>{error}</div>}

      {isMobile ? (
        <div className="mcards">
          {items.length === 0 && !loading ? (
            <div className="mcards-empty">Chưa có thay đổi nào.</div>
          ) : items.map(it => {
            const open = expanded.has(it.id)
            return (
              <div key={it.id} className="mcard" onClick={() => toggle(it.id)}>
                <div className="mcard-head">
                  <span style={{ fontWeight: 700, color: OP_COLORS[it.op], fontSize: 12 }}>{OP_LABELS[it.op] || it.op}</span>
                  <span className="mcard-title">{tableLabel(it.table_name)} {it.row_id != null && <span style={{ color: '#999' }}>#{it.row_id}</span>}</span>
                  <span className="mcard-amount" style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{open ? '▾' : '▸'}</span>
                </div>
                <div className="mcard-meta">
                  <span>{fmtDateTime(it.at)}</span>
                  <span>{it.actor_name || it.actor_email || '(hệ thống)'}</span>
                  {it.contract_out_id && (
                    <span onClick={e => e.stopPropagation()}>
                      <Link to={`/qlda/${it.contract_out_id}`}>{it.contract_no || `HĐ #${it.contract_out_id}`}</Link>
                    </span>
                  )}
                </div>
                {open && (
                  <div style={{ marginTop: 8, overflowX: 'auto' }} onClick={e => e.stopPropagation()}>
                    <AuditDiffTable row={it} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
      <div className="content-scrollable">
        <div className="table-wrapper">
          <table className="user-table audit-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th style={{ whiteSpace: 'nowrap' }}>Thời gian</th>
                <th style={{ whiteSpace: 'nowrap' }}>Người thao tác</th>
                <th style={{ whiteSpace: 'nowrap' }}>Thao tác</th>
                <th>Đối tượng</th>
                <th style={{ whiteSpace: 'nowrap' }}>Hợp đồng</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#666' }}>Chưa có thay đổi nào.</td></tr>
              ) : (
                items.map(it => {
                  const open = expanded.has(it.id)
                  return (
                    <FragmentRow
                      key={it.id}
                      it={it}
                      open={open}
                      onToggle={() => toggle(it.id)}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        {hasMore ? (
          <button className="add-btn" onClick={() => load(filters, page + 1)} disabled={loading}>
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </button>
        ) : (
          items.length > 0 && <span style={{ color: '#888', fontSize: 13 }}>Đã hiển thị hết.</span>
        )}
      </div>
    </>
  )
}

// Một dòng nhật ký + dòng chi tiết (diff) khi mở.
function FragmentRow({ it, open, onToggle }) {
  return (
    <>
      <tr className="audit-row" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ textAlign: 'center', color: '#888' }}>{open ? '▾' : '▸'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(it.at)}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{it.actor_name || it.actor_email || '(hệ thống)'}</td>
        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: OP_COLORS[it.op] }}>{OP_LABELS[it.op] || it.op}</td>
        <td>{tableLabel(it.table_name)} {it.row_id != null && <span style={{ color: '#999' }}>#{it.row_id}</span>}</td>
        <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          {it.contract_out_id ? (
            <Link to={`/qlda/${it.contract_out_id}`}>{it.contract_no || `HĐ #${it.contract_out_id}`}</Link>
          ) : <span style={{ color: '#bbb' }}>—</span>}
        </td>
      </tr>
      {open && (
        <tr className="audit-detail-row">
          <td></td>
          <td colSpan={5}><AuditDiffTable row={it} /></td>
        </tr>
      )}
    </>
  )
}
