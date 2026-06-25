import { useState, useEffect, useCallback, Fragment } from 'react'
import { API } from '../../config/api'
import EditGuard from './EditGuard'
import InvoiceBatchModal from './InvoiceBatchModal'
import usePasswordPrompt from './usePasswordPrompt'
import './ContractInvoiceTab.css'

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : ''

// SVG ổ khóa (đóng / mở) — dùng cho nút khóa đợt
const LockClosedIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0v2z"/></svg>
const LockOpenIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h9V6a3 3 0 0 0-6 0H7a5 5 0 0 1 10 0v2z"/></svg>

// Tab "Xuất hóa đơn" trong chi tiết HĐ bán (dưới "Công nợ"). Nhập theo từng đợt,
// xem số lượng tồn chưa xuất hóa đơn theo bảng giá.
export default function ContractInvoiceTab({ contractId }) {
  const [contract, setContract] = useState(null)
  const [boq, setBoq] = useState([])
  const [summary, setSummary] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | { } (new) | invoice (edit)
  const [expanded, setExpanded] = useState(null)
  const [hideZeroRemain, setHideZeroRemain] = useState(false)
  const { promptPassword, passwordModal } = usePasswordPrompt()

  const load = useCallback(async () => {
    try {
      const [c, b, s, inv] = await Promise.all([
        fetch(`${API}/contracts/${contractId}`).then(r => r.json()),
        fetch(`${API}/contracts/${contractId}/boq`).then(r => r.json()),
        fetch(`${API}/contracts/${contractId}/invoice-summary`).then(r => r.json()),
        fetch(`${API}/contracts/${contractId}/invoices`).then(r => r.json()),
      ])
      setContract(c && c.id ? c : null)
      setBoq(Array.isArray(b) ? b : [])
      setSummary(Array.isArray(s) ? s : [])
      setInvoices(Array.isArray(inv) ? inv : [])
    } catch (e) { console.error('load invoices:', e) }
    finally { setLoading(false) }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const cur = contract?.currency_code || 'VND'
  const totalContract = boq.reduce((s, b) => s + (parseFloat(b.amount_after_vat) || 0), 0)
  const totalInvoiced = invoices.reduce((s, i) => s + (parseFloat(i.total_after_vat) || 0), 0)
  const remainValue = summary.reduce((s, r) => s + (parseFloat(r.qty_remaining) || 0) * (parseFloat(r.unit_price) || 0), 0)

  const onDelete = async (inv) => {
    if (!confirm(`Xóa đợt xuất hóa đơn ${inv.invoice_no || ''} ngày ${fmtDate(inv.invoice_date)}?`)) return
    try {
      const res = await fetch(`${API}/invoices/${inv.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      load()
    } catch { alert('Không thể xóa.') }
  }

  // Khóa/mở khóa đợt — PM của HĐ/admin. Khi khóa, đợt không sửa/xóa được tới khi mở.
  // MỞ KHÓA cần nhập lại mật khẩu để xác nhận.
  const onToggleLock = async (inv) => {
    let password
    if (inv.locked) {
      password = await promptPassword({
        title: 'Mở khóa đợt xuất hóa đơn',
        message: 'Nhập mật khẩu của bạn để mở khóa đợt này.',
      })
      if (password == null) return   // hủy
    }
    try {
      const res = await fetch(`${API}/invoices/${inv.id}/lock`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !inv.locked, password }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Không thể đổi trạng thái khóa.'); return }
      load()
    } catch { alert('Không thể đổi trạng thái khóa.') }
  }

  if (loading) return <div className="inv-loading">Đang tải...</div>

  return (
    <div className="inv-tab">
      <div className="inv-cards">
        <div className="inv-card"><div className="inv-card-val">{fmt(totalContract)} {cur}</div><div className="inv-card-lbl">Tổng giá trị hợp đồng</div></div>
        <div className="inv-card"><div className="inv-card-val" style={{ color: '#2563eb' }}>{fmt(totalInvoiced)} {cur}</div><div className="inv-card-lbl">Đã xuất hóa đơn</div></div>
        <div className="inv-card"><div className="inv-card-val" style={{ color: '#d97706' }}>{fmt(remainValue)} {cur}</div><div className="inv-card-lbl">Giá trị tồn chưa xuất</div></div>
      </div>

      <div className="inv-section-head">
        <h3>Các đợt xuất hóa đơn</h3>
        <EditGuard>
          <button className="inv-add" onClick={() => setModal({})}>+ Thêm đợt xuất hóa đơn</button>
        </EditGuard>
      </div>

      {invoices.length === 0 ? (
        <p className="inv-empty-box">Chưa có đợt xuất hóa đơn nào.</p>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-list">
            <thead><tr><th>Ngày xuất</th><th>Số HĐ</th><th className="num">Số dòng</th><th className="num">Giá trị (sau VAT)</th><th>Ghi chú</th><th></th></tr></thead>
            <tbody>
              {invoices.map(inv => (
                <Fragment key={inv.id}>
                  <tr className="inv-row" onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                    <td>{expanded === inv.id ? '▾ ' : '▸ '}{fmtDate(inv.invoice_date)}</td>
                    <td>{inv.invoice_no || '—'}</td>
                    <td className="num">{(inv.items || []).length}</td>
                    <td className="num">{fmt(inv.total_after_vat)} {inv.currency_code}</td>
                    <td>{inv.note || '—'}</td>
                    <td className="inv-actions" onClick={e => e.stopPropagation()}>
                      {inv.locked && (
                        <span className="inv-locked-badge"
                          title={inv.locked_by_name
                            ? `Khóa bởi ${inv.locked_by_name}${inv.locked_at ? ` lúc ${fmtDateTime(inv.locked_at)}` : ''}`
                            : 'Đợt đã khóa'}>
                          🔒 Đã khóa{inv.locked_by_name ? ` · ${inv.locked_by_name}` : ''}
                        </span>
                      )}
                      <EditGuard>
                        {/* Nút khóa/mở khóa — luôn dùng được (để còn mở khóa) */}
                        <button className={`inv-lock-btn${inv.locked ? ' locked' : ''}`} onClick={() => onToggleLock(inv)}
                          title={inv.locked ? 'Mở khóa đợt' : 'Khóa đợt'}>
                          {inv.locked ? <LockClosedIcon /> : <LockOpenIcon />}
                          {inv.locked ? 'Mở khóa' : 'Khóa'}
                        </button>
                        {/* Sửa/Xóa — ẩn khi đã khóa */}
                        {!inv.locked && <>
                          <button className="inv-link" onClick={() => setModal(inv)}>Sửa</button>
                          <button className="inv-link inv-del-link" onClick={() => onDelete(inv)}>Xóa</button>
                        </>}
                      </EditGuard>
                    </td>
                  </tr>
                  {expanded === inv.id && (inv.items || []).map(it => (
                    <tr key={`it${it.id}`} className="inv-subrow">
                      <td colSpan={2}>{it.item_name}</td>
                      <td className="num">{fmt(it.quantity)} {it.unit}</td>
                      <td className="num">{fmt(it.amount_after_vat)}</td>
                      <td colSpan={2}>Đơn giá {fmt(it.unit_price)} · VAT {fmt(it.vat_rate)}%</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="inv-section-head">
        <h3>Tồn chưa xuất hóa đơn theo bảng giá</h3>
        {summary.length > 0 && (
          <label className="inv-filter-zero">
            <input type="checkbox" checked={hideZeroRemain} onChange={e => setHideZeroRemain(e.target.checked)} />
            Ẩn hàng đã xuất hết (Tồn = 0)
          </label>
        )}
      </div>
      {summary.length === 0 ? (
        <p className="inv-empty-box">Hợp đồng chưa có bảng giá.</p>
      ) : (() => {
        const rows = summary
          .map((r, idx) => ({ r, stt: idx + 1 }))
          .filter(({ r }) => !hideZeroRemain || (parseFloat(r.qty_remaining) || 0) > 0)
        if (rows.length === 0) return <p className="inv-empty-box">Tất cả mặt hàng đã xuất hóa đơn hết.</p>
        return (
        <div className="inv-table-wrap">
          <table className="inv-list">
            <thead><tr><th className="inv-stt">STT</th><th className="inv-item-name">Mặt hàng</th><th>ĐVT</th><th className="num">SL hợp đồng</th><th className="num">Đã xuất</th><th className="num">Tồn chưa xuất</th></tr></thead>
            <tbody>
              {rows.map(({ r, stt }) => {
                const remain = parseFloat(r.qty_remaining) || 0
                return (
                  <tr key={r.boq_id}>
                    <td className="inv-stt">{stt}</td>
                    <td className="inv-item-name">{r.item_name}</td><td>{r.unit}</td>
                    <td className="num">{fmt(r.qty_contract)}</td>
                    <td className="num">{fmt(r.qty_invoiced)}</td>
                    <td className={`num ${remain > 0 ? 'inv-remain' : 'inv-done'}`}>{fmt(remain)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      })()}

      {modal && (
        <InvoiceBatchModal
          contractId={contractId} contract={contract} boqItems={boq} summary={summary}
          initial={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {passwordModal}
    </div>
  )
}
