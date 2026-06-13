import { useState, useEffect, useCallback } from 'react'
import './ContractGuaranteeTab.css'
import DateInput from './DateInput'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import GuaranteeMobile from './GuaranteeMobile'
import NumberInput from '../common/NumberInput'
import EditGuard from './EditGuard'

import { API } from '../../config/api'

// Bảo lãnh HĐ mua luôn tính bằng VNĐ: bỏ phần thập phân, giữ phân cách hàng nghìn.
const dispAmount = (amt) => {
  if (amt === '' || amt == null) return ''
  const n = parseFloat(amt)
  return isNaN(n) ? '' : String(Math.round(n))
}

const GUARANTEE_TYPES = [
  'Bảo lãnh thanh toán',
  'Bảo lãnh thực hiện hợp đồng',
  'Bảo lãnh tạm ứng',
  'Bảo lãnh bảo hành',
  'Khác',
]

const STATUSES = ['Còn hiệu lực', 'Sắp hết hạn', 'Đã hết hạn', 'Đã hoàn trả']

const fmtVND  = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }

let _ctr = 0
const tmpId = () => `tmp_${++_ctr}`

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000)
}

function autoStatus(expiry_date, manualStatus) {
  if (manualStatus === 'Đã hoàn trả') return manualStatus
  if (!expiry_date) return manualStatus
  const days = daysUntil(expiry_date)
  if (days < 0)   return 'Đã hết hạn'
  if (days <= 30) return 'Sắp hết hạn'
  return 'Còn hiệu lực'
}

function StatusPill({ status }) {
  const cls =
    status === 'Còn hiệu lực' ? 'status-pill--active'   :
    status === 'Sắp hết hạn'  ? 'status-pill--expiring' :
    status === 'Đã hết hạn'   ? 'status-pill--expired'  :
    'status-pill--returned'
  return <span className={`status-pill ${cls}`}>{status}</span>
}

export default function ContractInGuaranteeTab({ contractInId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/guarantees`)
      const data = await res.json()
      setRows((Array.isArray(data) ? data : []).map(r => ({
        ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
      })))
    } catch (e) { console.error('load contract-in guarantees:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  const set = (key, field, val) =>
    setRows(prev => prev.map(r => r._key !== key ? r : { ...r, [field]: val, _dirty: true }))

  const addRow = () => {
    const r = {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      guarantee_type: 'Bảo lãnh thanh toán', amount: '', issue_date: '',
      expiry_date: '', status: 'Còn hiệu lực', note: '',
    }
    setRows(prev => [...prev, r])
    return r._key
  }

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      guarantee_type: row.guarantee_type, amount: row.amount,
      issue_date: row.issue_date, expiry_date: row.expiry_date,
      status: row.status, note: row.note,
    }
    try {
      const url    = row._isNew ? `${API}/contract-ins/${contractInId}/guarantees` : `${API}/contract-in-guarantees/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Lỗi lưu')
      setRows(prev => prev.map(r => r._key === row._key
        ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false }
        : r
      ))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa bảo lãnh "${row.guarantee_type || '(chưa đặt tên)'}"?`)) return
    try {
      await fetch(`${API}/contract-in-guarantees/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const isMobile = useIsMobile()

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  const saved     = rows.filter(r => !r._isNew)
  const active    = saved.filter(r => autoStatus(r.expiry_date, r.status) === 'Còn hiệu lực').length
  const expiring  = saved.filter(r => autoStatus(r.expiry_date, r.status) === 'Sắp hết hạn').length
  const expired   = saved.filter(r => autoStatus(r.expiry_date, r.status) === 'Đã hết hạn').length
  const totalAmt  = saved.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  if (loading) return <div className="guar-loading">Đang tải...</div>

  return (
    <div className="guar-tab">
      {/* Summary */}
      <div className="guar-summary">
        <div className="guar-card guar-card--blue">
          <div className="guar-card-label">Tổng giá trị bảo lãnh</div>
          <div className="guar-card-value">{fmtVND(totalAmt)}</div>
          <div className="guar-card-sub">{saved.length} bảo lãnh</div>
        </div>
        <div className="guar-card guar-card--green">
          <div className="guar-card-label">Còn hiệu lực</div>
          <div className="guar-card-value">{active}</div>
          <div className="guar-card-sub">bảo lãnh</div>
        </div>
        <div className="guar-card guar-card--orange">
          <div className="guar-card-label">Sắp hết hạn</div>
          <div className="guar-card-value">{expiring}</div>
          <div className="guar-card-sub">≤ 30 ngày</div>
        </div>
        <div className="guar-card guar-card--red">
          <div className="guar-card-label">Đã hết hạn</div>
          <div className="guar-card-value">{expired}</div>
          <div className="guar-card-sub">bảo lãnh</div>
        </div>
      </div>

      {/* Table */}
      <div className="guar-section">
        <div className="guar-section-header">
          <h4 className="guar-section-title">Danh sách bảo lãnh</h4>
          <EditGuard>
            <button className="guar-btn guar-btn-primary" onClick={addRow}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm bảo lãnh
            </button>
          </EditGuard>
        </div>

        <EditGuard>
        {isMobile ? (
          <GuaranteeMobile
            rows={rows} set={set} saveRow={saveRow} deleteRow={deleteRow} addRow={addRow}
            types={GUARANTEE_TYPES} statuses={STATUSES} contractCurrency="VND"
            pctOf={() => null} fmtVND={fmtVND} fmtPct={() => ''} autoStatus={autoStatus}
            StatusPill={StatusPill} totalAmt={totalAmt}
          />
        ) : (
        <div className="guar-table-wrapper">
          <table className="guar-table">
            <thead>
              <tr>
                <th className="th-stt">#</th>
                <th className="th-type">Loại bảo lãnh</th>
                <th className="th-amount">Giá trị (VNĐ)</th>
                <th className="th-date">Ngày phát hành</th>
                <th className="th-date">Ngày hết hạn</th>
                <th className="th-status">Trạng thái</th>
                <th className="th-note">Ghi chú</th>
                <th className="th-act"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="guar-empty">
                    Chưa có bảo lãnh nào. Nhấn <strong>Thêm bảo lãnh</strong> để bắt đầu.
                  </td>
                </tr>
              ) : rows.map((row, idx) => {
                const days     = daysUntil(row.expiry_date)
                const computed = autoStatus(row.expiry_date, row.status)
                const rowClass = [
                  row._dirty  ? 'row-dirty'   : '',
                  row._isNew  ? 'row-new'      : '',
                  row._saving ? 'row-saving'   : '',
                  !row._isNew && computed === 'Sắp hết hạn' ? 'row-expiring' : '',
                  !row._isNew && computed === 'Đã hết hạn'  ? 'row-expired'  : '',
                ].filter(Boolean).join(' ')

                return (
                  <tr key={row._key} className={rowClass}>
                    <td className="td-stt">
                      {row._dirty && <span className="dirty-dot" />}
                      <span>{idx + 1}</span>
                    </td>

                    <td>
                      <select value={row.guarantee_type || ''} onChange={e => set(row._key, 'guarantee_type', e.target.value)}>
                        {GUARANTEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>

                    <td>
                      <NumberInput value={dispAmount(row.amount)}
                        placeholder="0"
                        onChange={v => set(row._key, 'amount', v)} />
                    </td>

                    <td>
                      <DateInput value={row.issue_date?.slice(0, 10) || ''}
                        onChange={e => set(row._key, 'issue_date', e.target.value)} />
                    </td>

                    <td>
                      <DateInput value={row.expiry_date?.slice(0, 10) || ''}
                        onChange={e => set(row._key, 'expiry_date', e.target.value)} />
                      {!row._isNew && computed !== 'Đã hoàn trả' && days !== null && days >= 0 && days <= 30 && (
                        <span className="expiry-warn">Còn {days} ngày</span>
                      )}
                      {!row._isNew && computed !== 'Đã hoàn trả' && days !== null && days < 0 && (
                        <span className="expiry-error">Quá hạn {Math.abs(days)} ngày</span>
                      )}
                    </td>

                    <td>
                      <select value={row.status || 'Còn hiệu lực'} onChange={e => set(row._key, 'status', e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {!row._isNew && <StatusPill status={computed} />}
                    </td>

                    <td>
                      <input type="text" value={row.note || ''} placeholder="Ghi chú..."
                        onChange={e => set(row._key, 'note', e.target.value)} />
                    </td>

                    <td className="td-act">
                      <div className="action-group">
                        {row._dirty && (
                          <button className="act save" onClick={() => saveRow(row)} disabled={row._saving} title="Lưu">
                            {row._saving
                              ? <span className="spin">⟳</span>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                            }
                          </button>
                        )}
                        <button className="act delete" onClick={() => deleteRow(row)} title="Xóa">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {saved.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="2" className="totals-label">TỔNG GIÁ TRỊ</td>
                  <td style={{ fontWeight: 600 }}>{fmtVND(totalAmt)}</td>
                  <td colSpan="5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
        </EditGuard>
      </div>
    </div>
  )
}
