import { useState } from 'react'
import Modal from '../common/Modal'
import NumberInput from '../common/NumberInput'
import DateInput from './DateInput'
import { API } from '../../config/api'

let _k = 0
const key = () => `it_${++_k}`
const norm = (s) => String(s || '').trim().toLowerCase()
const num = (v) => parseFloat(v) || 0
const fmt = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })

const num0 = (v) => Math.max(0, parseFloat(v) || 0)

// Modal tạo/sửa một ĐỢT xuất hóa đơn.
// Tên hàng / ĐVT / Đơn giá / VAT của mỗi dòng CHỐT CỨNG theo bảng giá hợp đồng:
// người dùng chỉ chọn mặt hàng (từ bảng giá) và nhập Số lượng.
export default function InvoiceBatchModal({ contractId, contract, boqItems = [], summary = [], invoices = [], initial, onClose, onSaved }) {
  const defCur  = initial?.currency_code || contract?.currency_code || 'VND'
  const defRate = initial?.exchange_rate || contract?.exchange_rate || 1

  const boqByName = new Map(boqItems.map(b => [norm(b.item_name), b]))
  const boqById   = new Map(boqItems.map(b => [String(b.id), b]))

  // Lấy dòng bảng giá cho 1 hàng (ưu tiên boq_id, fallback theo tên).
  const boqOf = (r) => (r.boq_id ? boqById.get(String(r.boq_id)) : boqByName.get(norm(r.item_name))) || null

  // Tồn có thể xuất cho 1 mặt hàng = SL hợp đồng − SL đã nằm ở CÁC ĐỢT KHÁC.
  const sumByBoq = new Map(summary.map(s => [String(s.boq_id), s]))
  // Đường dẫn nhóm/phần (vd "Phần 1 › Hệ thống UPS") để phân biệt các mặt hàng trùng tên.
  const pathOf = (id) => sumByBoq.get(String(id))?.group_path || ''
  const label = (b) => { const p = pathOf(b.id); return p ? `${b.item_name} — ${p}` : b.item_name }
  // SL đã cam kết ở MỌI đợt khác (nháp lẫn đã xuất), TRỪ đợt đang sửa. Đợt nháp chưa bị
  // trừ trên bảng "Tồn chưa xuất" nên phải tự trừ ở đây để bảng thêm hàng / kiểm tra không
  // cho tổng các đợt vượt SL hợp đồng (khớp guard ở backend).
  const othersByBoq = new Map()
  for (const inv of invoices) {
    if (initial && String(inv.id) === String(initial.id)) continue
    for (const it of (inv.items || [])) {
      if (!it.boq_id) continue
      othersByBoq.set(String(it.boq_id), (othersByBoq.get(String(it.boq_id)) || 0) + num(it.quantity))
    }
  }
  const remainOf = (boqId) => {
    const s = sumByBoq.get(String(boqId))
    const contractQty = s ? num(s.qty_contract) : 0
    return contractQty - (othersByBoq.get(String(boqId)) || 0)
  }

  const [invoiceNo, setInvoiceNo] = useState(initial?.invoice_no || '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoice_date ? String(initial.invoice_date).slice(0, 10) : '')
  const [currency, setCurrency] = useState(defCur)
  const [rate, setRate] = useState(String(defRate))
  const [note, setNote] = useState(initial?.note || '')
  const [rows, setRows] = useState(() =>
    (initial?.items || []).map(it => {
      // Khớp lại với bảng giá để chốt cứng tên/đvt/đơn giá/VAT (kể cả dòng cũ tự nhập).
      const b = (it.boq_id && boqById.get(String(it.boq_id))) || boqByName.get(norm(it.item_name))
      return {
        _key: key(),
        boq_id: b?.id || it.boq_id || '',
        item_name: b?.item_name ?? it.item_name ?? '',
        unit: b?.unit ?? it.unit ?? '',
        unit_price: b?.unit_price ?? it.unit_price ?? '',
        vat_rate: b?.vat_rate ?? it.vat_rate ?? '',
        quantity: it.quantity ?? '',
      }
    }),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [picked, setPicked] = useState(() => new Set())

  const setRow = (k, patch) => setRows(prev => prev.map(r => r._key === k ? { ...r, ...patch } : r))
  const delRow = (k) => setRows(prev => prev.filter(r => r._key !== k))

  // Mở bảng chọn hàng tồn chưa xuất.
  const openPicker = () => { setPicked(new Set()); setShowPicker(true) }
  const togglePick = (id) => setPicked(prev => {
    const n = new Set(prev), k = String(id)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })
  // Các mặt hàng còn tồn chưa xuất và CHƯA có trong danh sách dòng hiện tại.
  const rowsBoqIds = new Set(rows.map(r => r.boq_id ? String(r.boq_id) : '').filter(Boolean))
  const pickerItems = boqItems
    .map(b => ({ b, remain: remainOf(b.id) }))
    .filter(({ b, remain }) => remain > 1e-6 && !rowsBoqIds.has(String(b.id)))
  const allChecked = pickerItems.length > 0 && pickerItems.every(({ b }) => picked.has(String(b.id)))
  const toggleAll = () => setPicked(allChecked ? new Set() : new Set(pickerItems.map(({ b }) => String(b.id))))
  // Thêm các mặt hàng đã chọn — SL mặc định = tồn chưa xuất (vẫn cho sửa lại ở bảng).
  const addPicked = () => {
    const toAdd = pickerItems
      .filter(({ b }) => picked.has(String(b.id)))
      .map(({ b, remain }) => ({
        _key: key(), boq_id: b.id, item_name: b.item_name, unit: b.unit,
        unit_price: b.unit_price, vat_rate: b.vat_rate, quantity: num0(remain),
      }))
    if (toAdd.length) setRows(prev => [...prev, ...toAdd])
    setShowPicker(false)
  }

  // Chọn mặt hàng từ bảng giá → chốt cứng tên/đvt/đơn giá/VAT, giữ nguyên SL.
  const pickBoq = (k, boqId) => {
    const b = boqById.get(String(boqId))
    if (!b) { setRow(k, { boq_id: '', item_name: '', unit: '', unit_price: '', vat_rate: '' }); return }
    setRow(k, { boq_id: b.id, item_name: b.item_name, unit: b.unit, unit_price: b.unit_price, vat_rate: b.vat_rate })
  }

  // Import Excel: chỉ đọc Tên hàng + Số lượng; ĐVT/Đơn giá/VAT lấy theo bảng giá (khớp theo tên).
  const onImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const imported = []
      const unknown = []
      for (const r of data) {
        const name = String(r[0] || '').trim()
        if (!name || /tên|mặt hàng|stt|nội dung/i.test(name)) continue   // bỏ header
        const qty = num(r[1])
        if (!qty) continue
        const b = boqByName.get(norm(name))
        if (!b) { unknown.push(name); continue }                          // không có trong bảng giá → bỏ
        imported.push({
          _key: key(), boq_id: b.id, item_name: b.item_name, unit: b.unit,
          unit_price: b.unit_price, vat_rate: b.vat_rate, quantity: qty,
        })
      }
      if (imported.length) setRows(prev => [...prev.filter(boqOf), ...imported])
      if (unknown.length)
        setError(`Bỏ qua mặt hàng không có trong bảng giá: ${[...new Set(unknown)].join(', ')}.`)
      else if (!imported.length)
        setError('Không đọc được dòng hợp lệ. Cột: Tên hàng | Số lượng.')
      else setError('')
    } catch (err) {
      console.error('import invoice:', err); setError('Lỗi đọc file Excel.')
    } finally { e.target.value = '' }
  }

  // Tải file Excel mẫu: liệt kê sẵn các dòng bảng giá, người dùng chỉ điền Số lượng.
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const header = ['Tên hàng', 'Số lượng']
    const body = boqItems.length
      ? boqItems.map(b => [b.item_name, ''])
      : [['Ví dụ: Máy chủ Dell R750', 1]]
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
    ws['!cols'] = [{ wch: 50 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'XuatHoaDon')
    XLSX.writeFile(wb, 'mau-xuat-hoa-don.xlsx')
  }

  // Xuất Excel đợt hiện tại: đủ 6 trường đang hiển thị (Tên hàng/ĐVT/SL/Đơn giá/VAT%/Thành tiền).
  const exportExcel = async () => {
    const items = rows.filter(r => boqOf(r))
    if (!items.length) { setError('Chưa có dòng nào để xuất.'); return }
    const XLSX = await import('xlsx')
    const header = ['Tên hàng', 'ĐVT', 'Số lượng', `Đơn giá (${currency})`, 'VAT%', `Thành tiền (${currency})`]
    const body = items.map(r => {
      const b = boqOf(r)
      const after = num(r.quantity) * num(b.unit_price) * (1 + num(b.vat_rate) / 100)
      return [b.item_name, b.unit || '', num(r.quantity), num(b.unit_price), num(b.vat_rate), after]
    })
    body.push(['', '', '', '', 'Tổng cộng', totalAfter])
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
    ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DotXuatHoaDon')
    const tag = invoiceNo ? `-${invoiceNo}`.replace(/[\\/:*?"<>|]/g, '_') : ''
    XLSX.writeFile(wb, `dot-xuat-hoa-don${tag}.xlsx`)
  }

  const totalBefore = rows.reduce((s, r) => s + num(r.quantity) * num(r.unit_price), 0)
  const totalAfter  = rows.reduce((s, r) => s + num(r.quantity) * num(r.unit_price) * (1 + num(r.vat_rate) / 100), 0)

  // Kiểm tra: mọi dòng phải chọn mặt hàng trong bảng giá và SL không vượt phần còn có thể
  // xuất = SL hợp đồng − SL đã cam kết ở các đợt khác (nháp + đã xuất, đã trừ đợt đang sửa).
  const validate = (items) => {
    const newQty = new Map()
    const notInCatalog = []
    for (const r of items) {
      const b = boqOf(r)
      if (!b) { notInCatalog.push(r.item_name.trim() || '(chưa chọn)'); continue }
      newQty.set(String(b.id), (newQty.get(String(b.id)) || 0) + num(r.quantity))
    }
    if (notInCatalog.length)
      return `Có dòng chưa chọn mặt hàng trong bảng giá: ${[...new Set(notInCatalog)].join(', ')}.`

    const overflow = []
    for (const [boqId, qty] of newQty) {
      const remain = remainOf(boqId)
      if (qty > remain + 1e-6)
        overflow.push(`${boqById.get(boqId)?.item_name || ''}: xuất ${fmt(qty)} / còn có thể xuất ${fmt(Math.max(0, remain))}`)
    }
    if (overflow.length)
      return `Số lượng vượt SL còn lại theo hợp đồng (đã tính cả các đợt nháp khác):\n${overflow.join('\n')}`
    return null
  }

  const save = async () => {
    const items = rows.filter(r => boqOf(r) && num(r.quantity) > 0)
    if (!items.length) { setError('Cần ít nhất 1 dòng đã chọn mặt hàng và có số lượng.'); return }
    const vErr = validate(items)
    if (vErr) { setError(vErr); return }
    setSaving(true); setError('')
    try {
      const body = {
        invoice_no: invoiceNo, invoice_date: invoiceDate || null,
        currency_code: currency, exchange_rate: num(rate) || 1, note,
        // Lưu giá trị chốt cứng từ bảng giá, không lấy giá trị tự gõ.
        items: items.map(r => {
          const b = boqOf(r)
          return {
            boq_id: b.id, item_name: b.item_name, unit: b.unit,
            quantity: num(r.quantity), unit_price: num(b.unit_price), vat_rate: num(b.vat_rate),
          }
        }),
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
    <Modal isOpen onClose={onClose} className="inv-batch-modal">
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
          <button type="button" className="inv-btn" onClick={openPicker}>+ Thêm hàng hóa</button>
          <label className="inv-import hide-on-mobile">⬆ Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={onImport} hidden />
          </label>
          <button type="button" className="inv-btn inv-tpl hide-on-mobile" onClick={downloadTemplate}>⬇ Tải file mẫu</button>
          <button type="button" className="inv-btn inv-export hide-on-mobile" onClick={exportExcel}>📤 Export Excel</button>
          <span className="inv-hint">Tên hàng / ĐVT / Đơn giá / VAT lấy theo bảng giá — chỉ chọn mặt hàng và nhập Số lượng.</span>
        </div>

        <div className="inv-items-wrap">
          <table className="inv-items">
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead><tr>
              <th>Tên hàng (theo bảng giá)</th><th>ĐVT</th><th className="num">SL</th>
              <th className="num">Đơn giá</th><th className="num">VAT%</th><th className="num">Thành tiền</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const after = num(r.quantity) * num(r.unit_price) * (1 + num(r.vat_rate) / 100)
                const picked = !!boqOf(r)
                // Ẩn mặt hàng đã được chọn ở dòng khác; vẫn giữ mặt hàng của chính dòng này.
                const options = boqItems.filter(b => !rowsBoqIds.has(String(b.id)) || String(b.id) === String(r.boq_id))
                return (
                  <tr key={r._key}>
                    <td>
                      <select className="inv-name-sel" value={r.boq_id} onChange={e => pickBoq(r._key, e.target.value)}>
                        <option value="">— Chọn mặt hàng —</option>
                        {options.map(b => <option key={b.id} value={b.id}>{label(b)}</option>)}
                      </select>
                    </td>
                    <td className="inv-lock">{r.unit || '—'}</td>
                    <td><NumberInput value={r.quantity} onChange={v => setRow(r._key, { quantity: v })} /></td>
                    <td className="inv-lock num">{picked ? fmt(r.unit_price) : '—'}</td>
                    <td className="inv-lock num">{picked ? fmt(r.vat_rate) : '—'}</td>
                    <td className="num inv-amount">{fmt(after)}</td>
                    <td><button type="button" className="inv-del" onClick={() => delRow(r._key)}>✕</button></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="inv-empty">Chưa có dòng nào. Thêm hàng hóa hoặc import Excel.</td></tr>}
            </tbody>
            <tfoot><tr>
              <td colSpan={5} className="num"><strong>Tổng cộng (sau VAT)</strong></td>
              <td className="num inv-amount"><strong>{fmt(totalAfter)} {currency}</strong></td><td></td>
            </tr></tfoot>
          </table>
        </div>

        <div className="inv-totals">Trước VAT: {fmt(totalBefore)} {currency} · Sau VAT: <strong>{fmt(totalAfter)} {currency}</strong></div>
        {error && <div className="inv-error">{error}</div>}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đợt'}</button>
      </div>

      {showPicker && (
        <Modal isOpen onClose={() => setShowPicker(false)} className="inv-picker-modal" width={720}>
          <div className="modal-header">
            <h3>Chọn hàng hóa (còn có thể xuất)</h3>
            <button className="modal-close" onClick={() => setShowPicker(false)}>×</button>
          </div>
          <div className="modal-body">
            {pickerItems.length === 0 ? (
              <div className="inv-empty">Không còn mặt hàng nào để thêm (đã thêm hết hoặc đã xuất hết tồn).</div>
            ) : (
              <div className="inv-items-wrap">
                <table className="inv-picker-table">
                  <colgroup>
                    <col style={{ width: '40px' }} />
                    <col />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '16%' }} />
                  </colgroup>
                  <thead><tr>
                    <th className="pk-check"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                    <th>Tên hàng</th><th>ĐVT</th>
                    <th className="num">Đơn giá</th><th className="num">VAT%</th><th className="num">Còn có thể xuất</th>
                  </tr></thead>
                  <tbody>
                    {pickerItems.map(({ b, remain }) => {
                      const on = picked.has(String(b.id))
                      return (
                        <tr key={b.id} className={on ? 'pk-on' : ''} onClick={() => togglePick(b.id)}>
                          <td className="pk-check">
                            <input type="checkbox" checked={on} onChange={() => togglePick(b.id)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td>{b.item_name}{pathOf(b.id) && <span className="inv-group-path">{pathOf(b.id)}</span>}</td>
                          <td>{b.unit || '—'}</td>
                          <td className="num">{fmt(b.unit_price)}</td>
                          <td className="num">{fmt(b.vat_rate)}</td>
                          <td className="num"><strong>{fmt(remain)}</strong></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowPicker(false)}>Hủy</button>
            <button className="btn-primary" onClick={addPicked} disabled={picked.size === 0}>
              Thêm{picked.size ? ` (${picked.size})` : ''}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
