import { Fragment } from 'react'
import { API } from '../../config/api'
import { fmtVND, fmtAmt, fmtDate, calcVND, receivableStatus, resolveDueDate, tmpId, needsRate } from './receivableUtils'
import RowActions from './ReceivableRowActions'
import LinkedPaymentsRow from './LinkedPaymentsRow'
import DateInput from './DateInput'

// ── Schedule section ──────────────────────────────────────────────────────────

export default function ScheduleSection({ rows, setRows, contractId, refTotal, refCurrency, refExRate, payRows, setPayRows, onRateSynced, bbDateMap = {}, baseOptions = [], contractDate = null }) {
  const dueCtx = { bbDateMap, contractDate }
  // % theo HĐ tính trên GIÁ TRỊ GỐC; giữ tới 4 chữ số thập phân để khoản nhỏ trên tổng HĐ lớn vẫn hiện ra.
  const ratioOf = (amt) => refTotal > 0 ? parseFloat((((parseFloat(amt) || 0) / refTotal) * 100).toFixed(4)) : ''

  const set = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: val, _dirty: true }

      // Nhập % theo HĐ → tự tính giá trị gốc (refTotal cùng đồng tiền HĐ)
      if (field === 'hd_ratio' && refTotal > 0) {
        const ratio = parseFloat(val) || 0
        updated.amount = parseFloat((refTotal * ratio / 100).toFixed(2))
        updated.amount_vnd = calcVND(updated.amount, updated.exchange_rate, updated.currency_code)
      }

      // Nhập giá trị (hoặc đổi tỷ giá/đồng tiền) → tự tính ngược % theo HĐ
      if (field === 'amount' || field === 'exchange_rate' || field === 'currency_code') {
        const cur = field === 'currency_code' ? val : updated.currency_code
        const amt = field === 'amount'        ? val : updated.amount
        const rt  = field === 'exchange_rate' ? val : updated.exchange_rate
        updated.amount_vnd = calcVND(amt, rt, cur)
        if (cur === 'VND') updated.exchange_rate = 1
        if (field === 'amount') updated.hd_ratio = ratioOf(amt)
      }
      return updated
    }))

  // Chọn mốc gốc cho thời hạn thu: '' = nhập tay, 'contract' = ngày ký HĐ, còn lại = id loại biên bản
  const setDueBase = (key, val) =>
    setRows(prev => prev.map(r => r._key === key ? {
      ...r, _dirty: true,
      due_base_anchor:     val === 'contract' ? 'contract' : '',
      due_base_bb_type_id: (val === 'contract' || val === '') ? '' : val,
    } : r))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    description: '', currency_code: refCurrency || 'VND', amount: '', exchange_rate: refCurrency !== 'VND' ? (refExRate || '') : 1,
    amount_vnd: 0, due_date: '', delay_reason: '',
    due_offset_days: '', due_base_bb_type_id: '', due_base_anchor: '',
  }])

  const saveRow = async (row) => {
    if (needsRate(row)) {
      alert(`Vui lòng nhập tỷ giá quy đổi VNĐ cho đồng tiền ${row.currency_code}.`)
      return
    }
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      description: row.description, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      // due_date lưu giá trị đã giải (động theo biên bản hoặc nhập tay) để các nơi khác đọc được mốc thực
      due_date: resolveDueDate(row, dueCtx),
      delay_reason: row.delay_reason,
      due_offset_days: row.due_offset_days,
      due_base_bb_type_id: row.due_base_bb_type_id || null,
      due_base_anchor: row.due_base_anchor || null,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/receivable` : `${API}/receivable/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : r))
      // Backend đã đồng bộ tỷ giá HĐ theo bản ghi này → tải lại tham chiếu để banner/UI cập nhật
      if ((row.currency_code || refCurrency) !== 'VND' && parseFloat(row.exchange_rate) > 0) onRateSynced?.()
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa khoản phải thu "${row.description || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/receivable/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalAmt = rows.filter(r => !r._isNew).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totalVND = rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)
  const unit     = refCurrency === 'VND' ? 'đ' : refCurrency

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Phải thu theo ĐKTT hợp đồng</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm khoản
        </button>
      </div>

      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-desc">Mô tả điều kiện thanh toán</th>
              <th className="th-ratio2">% theo HĐ</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-date">Thời hạn thu</th>
              <th className="th-reason">Nguyên nhân trượt</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="10" className="recv-empty">Chưa có khoản phải thu nào. Nhấn <strong>Thêm khoản</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const linked = payRows.filter(p => p._isNew ? p._schedKey === row._key : String(p.schedule_id) === String(row.id))
              const dueResolved = resolveDueDate(row, dueCtx)
              const status = row._isNew ? null : receivableStatus(row, linked, dueResolved)
              const isLate = status?.color === 'red'
              const dueBaseVal  = row.due_base_anchor === 'contract' ? 'contract' : (row.due_base_bb_type_id || '')
              const dueComputed = dueBaseVal !== ''
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              const hdRatio = row.hd_ratio != null ? row.hd_ratio : ratioOf(row.amount)
              return (
                <Fragment key={row._key}>
                <tr className={[
                  status ? `recv-row--${status.color}` : '',
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-desc">
                    <input type="text" value={row.description || ''} placeholder="VD: 30% đặt cọc khi ký HĐ..."
                      onChange={e => set(row._key, 'description', e.target.value)} />
                  </td>
                  <td className="td-ratio2">
                    <div className="ratio-cell">
                      <input type="number" value={hdRatio === '' ? '' : hdRatio}
                        min="0" max="100" step="0.0001"
                        placeholder={refTotal > 0 ? '30' : '—'}
                        title={refTotal > 0 ? `Nhập % → tự tính giá trị từ tổng HĐ (${fmtAmt(refTotal, refCurrency)} ${unit})` : 'Chưa có dữ liệu BOQ'}
                        disabled={refTotal === 0}
                        onChange={e => set(row._key, 'hd_ratio', e.target.value)} />
                      <span className="ratio-pct">%</span>
                    </div>
                  </td>
                  <td className="td-cur">
                    <span className="currency-badge">{row.currency_code || refCurrency || 'VND'}</span>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : (typeof row.amount === 'number' ? row.amount.toFixed(2) : row.amount)}
                      min="0" placeholder="0" onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number" value={(row.currency_code || refCurrency) === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={(row.currency_code || refCurrency) === 'VND'} min="0"
                      placeholder={needsRate(row) ? 'Bắt buộc!' : '1'}
                      className={needsRate(row) ? 'input-warn' : ''}
                      title={needsRate(row) ? `Nhập tỷ giá VNĐ/${row.currency_code}` : ''}
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-date">
                    <div className="due-cell">
                      <div className="due-row">
                        <select className="due-base" value={dueBaseVal}
                          title="Mốc tính thời hạn thu: nhập ngày trực tiếp, hoặc tính theo số ngày kể từ biên bản / ngày ký HĐ"
                          onChange={e => setDueBase(row._key, e.target.value)}>
                          <option value="">Nhập ngày</option>
                          <option value="contract">Ngày ký HĐ</option>
                          {baseOptions.map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                        </select>
                        {dueComputed && (
                          <>
                            <input className="due-days" type="number" min="0" max="999"
                              value={row.due_offset_days ?? ''} placeholder="0"
                              title="Số ngày kể từ ngày của biên bản gốc"
                              onChange={e => set(row._key, 'due_offset_days', e.target.value.slice(0, 3))} />
                            <span className="due-from">ngày</span>
                          </>
                        )}
                      </div>
                      {dueComputed
                        ? <span className="due-resolved">→ {fmtDate(dueResolved)}</span>
                        : <DateInput value={row.due_date?.slice(0, 10) || ''}
                            onChange={e => set(row._key, 'due_date', e.target.value)} />}
                      {status && <span className={`recv-status recv-status--${status.color}`}>{status.label}</span>}
                    </div>
                  </td>
                  <td className="td-reason">
                    <input type="text" value={row.delay_reason || ''}
                      placeholder={isLate ? 'Nhập nguyên nhân...' : ''}
                      className={isLate && !row.delay_reason ? 'input-warn' : ''}
                      onChange={e => set(row._key, 'delay_reason', e.target.value)} />
                  </td>
                  <td className="td-act">
                    <RowActions row={row} onSave={saveRow} onDelete={deleteRow} />
                  </td>
                </tr>
                <LinkedPaymentsRow
                  schedRow={row}
                  payRows={payRows}
                  setPayRows={setPayRows}
                  contractId={contractId}
                  colSpan={10}
                />
                </Fragment>
              )
            })}
          </tbody>
          {rows.filter(r => !r._isNew).length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="4" className="totals-label">TỔNG PHẢI THU</td>
                <td className="td-num totals-amount">{fmtAmt(totalAmt, refCurrency)} {unit}</td>
                <td />
                <td className="td-vnd">{fmtVND(totalVND)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
