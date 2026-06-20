import { useState, useEffect, useCallback, Fragment } from 'react'
import { API } from '../../config/api'
import EditGuard from './EditGuard'
import InvoiceBatchModal from './InvoiceBatchModal'
import './ContractInvoiceTab.css'

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

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
                      <EditGuard>
                        <button className="inv-link" onClick={() => setModal(inv)}>Sửa</button>
                        <button className="inv-link inv-del-link" onClick={() => onDelete(inv)}>Xóa</button>
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

      <div className="inv-section-head"><h3>Tồn chưa xuất hóa đơn theo bảng giá</h3></div>
      {summary.length === 0 ? (
        <p className="inv-empty-box">Hợp đồng chưa có bảng giá.</p>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-list">
            <thead><tr><th>Mặt hàng</th><th>ĐVT</th><th className="num">SL hợp đồng</th><th className="num">Đã xuất</th><th className="num">Tồn chưa xuất</th></tr></thead>
            <tbody>
              {summary.map(r => {
                const remain = parseFloat(r.qty_remaining) || 0
                return (
                  <tr key={r.boq_id}>
                    <td>{r.item_name}</td><td>{r.unit}</td>
                    <td className="num">{fmt(r.qty_contract)}</td>
                    <td className="num">{fmt(r.qty_invoiced)}</td>
                    <td className={`num ${remain > 0 ? 'inv-remain' : 'inv-done'}`}>{fmt(remain)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <InvoiceBatchModal
          contractId={contractId} contract={contract} boqItems={boq} summary={summary}
          initial={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
