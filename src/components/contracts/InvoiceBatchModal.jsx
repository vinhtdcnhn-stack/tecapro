import { useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from '../common/Modal'
import NumberInput from '../common/NumberInput'
import DateInput from './DateInput'
import { API } from '../../config/api'

let _k = 0
const key = () => `it_${++_k}`
const norm = (s) => String(s || '').trim().toLowerCase()
const num = (v) => parseFloat(v) || 0
const fmt = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })

const blankRow = () => ({ _key: key(), boq_id: '', item_name: '', unit: '', quantity: '', unit_price: '', vat_rate: '' })

// Modal tạo/sửa một ĐỢT xuất hóa đơn (nhập tay từng dòng hoặc import Excel).
export default function InvoiceBatchModal({ contractId, contract, boqItems = [], summary = [], initial, onClose, onSaved }) {
  const defCur  = initial?.currency_code || contract?.currency_code || 'VND'
  const defRate = initial?.exchange_rate || contract?.exchange_rate || 1

  const [invoiceNo, setInvoiceNo] = useState(initial?.invoice_no || '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoice_date ? String(initial.invoice_date).slice(0, 10) : '')
  const [currency, setCurrency] = useState(defCur)
  const [rate, setRate] = useState(String(defRate))
  const [note, setNote] = useState(initial?.note || '')
  const [rows, setRows] = useState(() =>
    (initial?.items || []).map(it => ({
      _key: key(), boq_id: it.boq_id || '', item_name: it.item_name || '', unit: it.unit || '',
      quantity: it.quantity ?? '', unit_price: it.unit_price ?? '', vat_rate: it.vat_rate ?? '',
    })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const boqByName = new Map(boqItems.map(b => [norm(b.item_name), b]))
  const boqById   = new Map(boqItems.map(b => [String(b.id), b]))

  const setRow = (k, patch) => setRows(prev => prev.map(r => r._key === k ? { ...r, ...patch } : r))
  const addRow = () => setRows(prev => [...prev, blankRow()])
  const delRow = (k) => setRows(prev => prev.filter(r => r._key !== k))

  // Chọn dòng bảng giá → điền sẵn tên/đvt/đơn giá/VAT.
  const pickBoq = (k, boqId) => {
    const b = boqItems.find(x => String(x.id) === String(boqId))
    if (!b) { setRow(k, { boq_id: '' }); return }
    setRow(k, { boq_id: b.id, item_name: b.item_name, unit: b.unit, unit_price: b.unit_price, vat_rate: b.vat_rate })
  }

  // Import Excel: đọc cột Tên/SL/Đơn giá/VAT, khớp bảng giá theo tên nếu có.
  const onImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const imported = []
      for (const r of data) {
        const name = String(r[0] || '').trim()
        if (!name || /tên|mặt hàng|stt|nội dung/i.test(name)) continue   // bỏ header
        const qty = num(r[1])
        if (!qty) continue
        const b = boqByName.get(norm(name))
        imported.push({
          _key: key(), boq_id: b?.id || '', item_name: name, unit: b?.unit || String(r[4] || ''),
          quantity: qty, unit_price: r[2] !== '' ? num(r[2]) : (b?.unit_price ?? ''),
          vat_rate: r[3] !== '' ? num(r[3]) : (b?.vat_rate ?? ''),
        })
      }
      if (imported.length) setRows(prev => [...prev.filter(r => r.item_name || r.quantity), ...imported])
      else setError('Không đọc được dòng hợp lệ. Cột: Tên | Số lượng | Đơn giá | VAT%.')
    } catch (err) {
      console.error('import invoice:', err); setError('Lỗi đọc file Excel.')
    } finally { e.target.value = '' }
  }

  // Tải file Excel mẫu: header + sẵn các dòng bảng giá (đơn giá/VAT/ĐVT), người dùng chỉ điền Số lượng.
  const downloadTemplate = () => {
    const header = ['Tên hàng', 'Số lượng', 'Đơn giá', 'VAT%', 'ĐVT']
    const body = boqItems.length
      ? boqItems.map(b => [b.item_name, '', num(b.unit_price), num(b.vat_rate), b.unit || ''])
      : [['Ví dụ: Máy chủ Dell R750', 1, 0, 10, 'Cái']]
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
    ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'XuatHoaDon')
    XLSX.writeFile(wb, 'mau-xuat-hoa-don.xlsx')
  }

  const totalBefore = rows.reduce((s, r) => s + num(r.quantity) * num(r.unit_price), 0)
  const totalAfter  = rows.reduce((s, r) => s + num(r.quantity) * num(r.unit_price) * (1 + num(r.vat_rate) / 100), 0)

  // Kiểm tra: mọi dòng phải khớp bảng giá, và SL không vượt tồn chưa xuất hóa đơn.
  // Trả về chuỗi lỗi (chặn lưu) hoặc null. Khi sửa đợt, cộng lại SL của chính đợt này
  // (đã nằm trong qty_invoiced) để không tự tính là vượt.
  const validate = (items) => {
    const newQty = new Map()
    const notInCatalog = []
    const unitMismatch = []
    for (const r of items) {
      const b = r.boq_id ? boqById.get(String(r.boq_id)) : boqByName.get(norm(r.item_name))
      if (!b) { notInCatalog.push(r.item_name.trim()); continue }
      const bUnit = norm(b.unit)
      if (bUnit && norm(r.unit) !== bUnit) {
        unitMismatch.push(`${r.item_name.trim()}: ĐVT "${(r.unit || '').trim()}" ≠ bảng giá "${b.unit}"`)
        continue
      }
      newQty.set(String(b.id), (newQty.get(String(b.id)) || 0) + num(r.quantity))
    }
    if (notInCatalog.length)
      return `Mặt hàng không có trong bảng giá hợp đồng: ${[...new Set(notInCatalog)].join(', ')}. Hãy chọn dòng bảng giá tương ứng (cột "Dòng bảng giá").`
    if (unitMismatch.length)
      return `Đơn vị tính không khớp bảng giá:\n${unitMismatch.join('\n')}`

    const sumByBoq = new Map(summary.map(s => [String(s.boq_id), s]))
    const initialByBoq = new Map()
    for (const it of (initial?.items || [])) {
      if (!it.boq_id) continue
      initialByBoq.set(String(it.boq_id), (initialByBoq.get(String(it.boq_id)) || 0) + num(it.quantity))
    }
    const overflow = []
    for (const [boqId, qty] of newQty) {
      const s = sumByBoq.get(boqId)
      const contractQty = s ? num(s.qty_contract) : 0
      const already = (s ? num(s.qty_invoiced) : 0) - (initialByBoq.get(boqId) || 0)
      const remain = contractQty - already
      if (qty > remain + 1e-6)
        overflow.push(`${boqById.get(boqId)?.item_name || ''}: xuất ${fmt(qty)} / tồn chưa xuất ${fmt(Math.max(0, remain))}`)
    }
    if (overflow.length)
      return `Số lượng vượt tồn chưa xuất hóa đơn theo bảng giá:\n${overflow.join('\n')}`
    return null
  }

  const save = async () => {
    const items = rows.filter(r => r.item_name.trim() && num(r.quantity) > 0)
    if (!items.length) { setError('Cần ít nhất 1 dòng có tên và số lượng.'); return }
    const vErr = validate(items)
    if (vErr) { setError(vErr); return }
    setSaving(true); setError('')
    try {
      const body = {
        invoice_no: invoiceNo, invoice_date: invoiceDate || null,
        currency_code: currency, exchange_rate: num(rate) || 1, note,
        items: items.map(r => ({
          boq_id: r.boq_id || null, item_name: r.item_name, unit: r.unit,
          quantity: num(r.quantity), unit_price: num(r.unit_price), vat_rate: num(r.vat_rate),
        })),
      }
      const url = initial ? `${API}/invoices/${initial.id}` : `${API}/contracts/${contractId}/invoices`
      const res = await fetch(url, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại')
      onSaved()
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} width={920}>
      <div className="modal-header">
        <h3>{initial ? 'Sửa đợt xuất hóa đơn' : 'Thêm đợt xuất hóa đơn'}</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div className="inv-form-grid">
          <label>Số hóa đơn<input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Số HĐ GTGT" /></label>
          <label>Ngày xuất<DateInput value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
          <label>Tiền tệ
            <select value={currency} onChange={e => setCurrency(e.target.value)}>
              {['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {currency !== 'VND' && <label>Tỷ giá<NumberInput value={rate} onChange={setRate} integer /></label>}
          <label className="inv-note">Ghi chú<input value={note} onChange={e => setNote(e.target.value)} /></label>
        </div>

        <div className="inv-items-toolbar">
          <button type="button" className="inv-btn" onClick={addRow}>+ Thêm dòng</button>
          <label className="inv-import">⬆ Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={onImport} hidden />
          </label>
          <button type="button" className="inv-btn inv-tpl" onClick={downloadTemplate}>⬇ Tải file mẫu</button>
          <span className="inv-hint">Excel: cột Tên | Số lượng | Đơn giá | VAT% | ĐVT</span>
        </div>

        <div className="inv-items-wrap">
          <table className="inv-items">
            <thead><tr>
              <th>Dòng bảng giá</th><th>Tên hàng</th><th>ĐVT</th><th className="num">SL</th>
              <th className="num">Đơn giá</th><th className="num">VAT%</th><th className="num">Thành tiền</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const after = num(r.quantity) * num(r.unit_price) * (1 + num(r.vat_rate) / 100)
                return (
                  <tr key={r._key}>
                    <td>
                      <select value={r.boq_id} onChange={e => pickBoq(r._key, e.target.value)}>
                        <option value="">— Tự nhập —</option>
                        {boqItems.map(b => <option key={b.id} value={b.id}>{b.item_name}</option>)}
                      </select>
                    </td>
                    <td><input value={r.item_name} onChange={e => setRow(r._key, { item_name: e.target.value })} /></td>
                    <td><input className="inv-unit" value={r.unit} onChange={e => setRow(r._key, { unit: e.target.value })} /></td>
                    <td><NumberInput value={r.quantity} onChange={v => setRow(r._key, { quantity: v })} /></td>
                    <td><NumberInput value={r.unit_price} onChange={v => setRow(r._key, { unit_price: v })} /></td>
                    <td><NumberInput value={r.vat_rate} onChange={v => setRow(r._key, { vat_rate: v })} /></td>
                    <td className="num">{fmt(after)}</td>
                    <td><button type="button" className="inv-del" onClick={() => delRow(r._key)}>✕</button></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="inv-empty">Chưa có dòng nào. Thêm dòng hoặc import Excel.</td></tr>}
            </tbody>
            <tfoot><tr>
              <td colSpan={6} className="num"><strong>Tổng cộng</strong></td>
              <td className="num"><strong>{fmt(totalAfter)} {currency}</strong></td><td></td>
            </tr></tfoot>
          </table>
        </div>
        <div className="inv-totals">Trước VAT: {fmt(totalBefore)} · Sau VAT: <strong>{fmt(totalAfter)} {currency}</strong></div>
        {error && <div className="inv-error">{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đợt'}</button>
      </div>
    </Modal>
  )
}
