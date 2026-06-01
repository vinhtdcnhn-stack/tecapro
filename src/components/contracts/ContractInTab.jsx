import { useState, useEffect, useCallback } from 'react'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const CURRENCIES    = ['VND', 'USD', 'EUR', 'JPY', 'CNY']
const PURCHASE_TYPES= ['Trong nước', 'Nhập khẩu']
const STATUSES      = ['Active', 'Completed', 'Cancelled']

const thStyle = (w, align = 'left') => ({
  padding: '9px 12px', textAlign: align, fontSize: 11, fontWeight: 600,
  color: '#4b5563', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  width: w, minWidth: w,
})
const tdStyle = (align = 'left', extra = {}) => ({
  padding: '10px 12px', textAlign: align, borderBottom: '1px solid #f3f4f6',
  fontSize: 13, verticalAlign: 'middle', whiteSpace: 'nowrap', ...extra,
})

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-'
const fmtNum  = (n) => n === null || n === undefined ? '-' : new Intl.NumberFormat('vi-VN').format(Math.round(parseFloat(n)||0))
const statusCfg = {
  Active:    { label: 'Đang thực hiện', cls: 'status-active' },
  Completed: { label: 'Hoàn thành',     cls: 'status-completed' },
  Cancelled: { label: 'Hủy bỏ',         cls: 'status-cancelled' },
}

export default function ContractInTab({ contractId }) {
  const [items, setItems]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModal]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    try {
      const [iRes, sRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/contract-ins`),
        fetch(`${API}/suppliers`),
      ])
      const [iData, sData] = await Promise.all([iRes.json(), sRes.json()])
      setItems(Array.isArray(iData) ? iData : [])
      setSuppliers(Array.isArray(sData) ? sData : [])
    } catch (e) { console.error('load contract-ins:', e) }
    finally { setLoading(false) }
  }, [contractId])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(c => {
    const t = search.toLowerCase()
    return !t || c.contract_no?.toLowerCase().includes(t) ||
      c.goods_type?.toLowerCase().includes(t) ||
      c.supplier_name?.toLowerCase().includes(t)
  })

  // Stats
  const totalAmount = items.reduce((s, c) => s + (parseFloat(c.amount)||0), 0)
  const active      = items.filter(c => c.status === 'Active').length
  const completed   = items.filter(c => c.status === 'Completed').length

  async function handleSave(form, isEdit) {
    const url    = isEdit ? `${API}/contract-ins/${editItem.id}` : `${API}/contracts/${contractId}/contract-ins`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
    if (isEdit) setItems(prev => prev.map(x => x.id === editItem.id ? data : x))
    else setItems(prev => [data, ...prev])
    setModal(false)
  }

  async function handleDelete(item) {
    if (!confirm(`Xóa hợp đồng nhập "${item.contract_no||'(chưa có số)'}"?`)) return
    await fetch(`${API}/contract-ins/${item.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(x => x.id !== item.id))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">HỢP ĐỒNG NHẬP</h1>
        <p className="page-subtitle">Danh sách hợp đồng đầu vào thuộc hợp đồng bán này</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-label">Tổng HĐ nhập</p>
          <p className="stat-value">{items.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Đang thực hiện</p>
          <p className="stat-value text-green-600">{active}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Hoàn thành</p>
          <p className="stat-value text-blue-600">{completed}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Tổng giá trị (VNĐ)</p>
          <p className="stat-value money">{fmtNum(totalAmount)} ₫</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4" style={{ gap: 12 }}>
        <button className="btn-primary" onClick={() => { setEditItem(null); setModal(true) }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm HĐ nhập
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Tìm số HĐ, loại hàng hóa, nhà cung cấp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Result count */}
      <div className="mb-2 text-sm text-gray-500">
        Hiển thị: <span className="font-medium text-gray-700">{filtered.length}</span> / {items.length} hợp đồng nhập
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={thStyle('52px', 'center')}>Quản trị</th>
                <th style={thStyle('130px')}>Số HĐ nhập</th>
                <th style={thStyle('180px')}>Loại hàng hóa</th>
                <th style={thStyle('100px')}>Ngày HĐ</th>
                <th style={thStyle('200px')}>Nhà cung cấp</th>
                <th style={thStyle('140px', 'right')}>Giá trị</th>
                <th style={thStyle('70px', 'center')}>Tiền tệ</th>
                <th style={thStyle('90px', 'right')}>Tỷ giá</th>
                <th style={thStyle('110px', 'center')}>Loại mua hàng</th>
                <th style={thStyle('120px', 'center')}>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 table-body">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm">Chưa có hợp đồng nhập nào. Nhấn <strong>Thêm HĐ nhập</strong> để tạo mới.</p>
                  </td>
                </tr>
              ) : filtered.map(c => {
                const sc = statusCfg[c.status] || { label: c.status, cls: '' }
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={tdStyle('center')}>
                      <button className="btn-manage"
                        onClick={() => { setEditItem(c); setModal(true) }}
                        title="Quản trị hợp đồng nhập">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </td>
                    <td style={tdStyle('left', { fontWeight: 600 })}>{c.contract_no || '-'}</td>
                    <td style={tdStyle('left', { whiteSpace: 'normal', maxWidth: 200 })}>{c.goods_type || '-'}</td>
                    <td style={tdStyle()}>{fmtDate(c.contract_date)}</td>
                    <td style={tdStyle()}>{c.supplier_name || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={tdStyle('right', { fontWeight: 600 })}>{fmtNum(c.amount)}</td>
                    <td style={tdStyle('center', { color: '#6b7280' })}>{c.currency_code}</td>
                    <td style={tdStyle('right', { color: '#6b7280' })}>
                      {c.exchange_rate ? new Intl.NumberFormat('vi-VN').format(c.exchange_rate) : '—'}
                    </td>
                    <td style={tdStyle('center')}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                        background: c.purchase_type === 'Nhập khẩu' ? '#ede9fe' : '#dbeafe',
                        color: c.purchase_type === 'Nhập khẩu' ? '#6d28d9' : '#1d4ed8',
                      }}>{c.purchase_type}</span>
                    </td>
                    <td style={tdStyle('center')}>
                      <span className={`status-badge ${sc.cls}`}>{sc.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ContractInModal
          item={editItem}
          suppliers={suppliers}
          onSave={handleSave}
          onDelete={editItem ? handleDelete : null}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

// ── Modal thêm / sửa ──────────────────────────────────────────────────────────

function ContractInModal({ item, suppliers, onSave, onDelete, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    contract_no:   item?.contract_no   || '',
    goods_type:    item?.goods_type    || '',
    contract_date: item?.contract_date?.slice(0, 10) || '',
    supplier_id:   item?.supplier_id   || '',
    amount:        item?.amount        || '',
    currency_code: item?.currency_code || 'VND',
    exchange_rate: item?.exchange_rate || '',
    purchase_type: item?.purchase_type || 'Trong nước',
    status:        item?.status        || 'Active',
    note:          item?.note          || '',
  })
  const [saving, setSaving] = useState(false)

  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal contract-modal" style={{ width: 680, maxWidth: '95vw' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'CẬP NHẬT HỢP ĐỒNG NHẬP' : 'THÊM HỢP ĐỒNG NHẬP'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="contract-form-section">
            <div className="form-row">
              <div className="form-group">
                <label>Số hợp đồng nhập</label>
                <input type="text" value={form.contract_no}
                  onChange={e => s({ contract_no: e.target.value })}
                  placeholder="VD: HD-NCC-2026-001" />
              </div>
              <div className="form-group">
                <label>Ngày hợp đồng</label>
                <input type="date" value={form.contract_date}
                  onChange={e => s({ contract_date: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Loại hàng hóa</label>
                <input type="text" value={form.goods_type}
                  onChange={e => s({ goods_type: e.target.value })}
                  placeholder="VD: Thiết bị điện, Cáp nguồn, Phần mềm bản quyền..." />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Nhà cung cấp (Supplier)</label>
                <select value={form.supplier_id} onChange={e => s({ supplier_id: e.target.value })}>
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Giá trị hợp đồng</label>
                <input type="number" value={form.amount} min="0"
                  onChange={e => s({ amount: e.target.value })}
                  placeholder="0" />
              </div>
              <div className="form-group">
                <label>Đơn vị tiền tệ</label>
                <select value={form.currency_code} onChange={e => s({ currency_code: e.target.value })}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tỷ giá</label>
                <input type="number" value={form.exchange_rate} min="0" step="0.0001"
                  placeholder={form.currency_code === 'VND' ? '1' : 'Nhập tỷ giá'}
                  onChange={e => s({ exchange_rate: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Loại mua hàng</label>
                <select value={form.purchase_type} onChange={e => s({ purchase_type: e.target.value })}>
                  {PURCHASE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Trạng thái</label>
                <select value={form.status} onChange={e => s({ status: e.target.value })}>
                  {STATUSES.map(st => (
                    <option key={st} value={st}>{statusCfg[st]?.label || st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Ghi chú</label>
                <textarea rows="3" value={form.note}
                  onChange={e => s({ note: e.target.value })}
                  placeholder="Ghi chú thêm về hợp đồng nhập..." />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
          {isEdit && (
            <button
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              onClick={() => { onDelete(item); onClose() }}
            >
              Xóa HĐ nhập
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="cancel-btn" onClick={onClose}>Hủy</button>
            <button className="save-btn" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
