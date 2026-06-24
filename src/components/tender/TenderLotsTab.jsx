import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import NumberInput from '../common/NumberInput'
import { RESULTS, resultColor, fmtMoney, fmtAmount, ccySuffix } from './tenderUtils'
import TenderLotBidders from './TenderLotBidders'

// Tab "Kết quả dự thầu": quản lý LÔ của gói (mỗi lô có dự toán + kết quả Trúng/Trượt)
// và trong mỗi lô là danh sách nhà thầu + xếp hạng giá. Gói không chia lô → tạo 1 lô
// "Toàn gói". Quyền sửa = người làm thầu của gói / Trưởng phòng / admin (canEdit).

const emptyDraft = () => ({ id: null, lot_name: '', lot_code: '', estimate: '', result: '', note: '' })

export default function TenderLotsTab({ tender, canEdit, onChanged }) {
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)   // form thêm/sửa lô đang mở
  const [busy, setBusy] = useState(false)

  const ccy = tender.currency_code || 'VND'
  const rate = Number(tender.exchange_rate) || 0
  const isForeign = !!ccy && ccy !== 'VND'

  // Gói không chia lô = đúng 1 lô mặc định "Toàn gói". Dùng để loại trừ 2 nút:
  // đã chọn "Gói không chia lô" → ẩn "+ Thêm lô"; đã thêm lô thật → ẩn "Gói không chia lô".
  const isWholePackage = lots.length === 1 && lots[0].lot_name === 'Toàn gói'

  const load = useCallback(() => {
    fetch(`${API}/tender/${tender.id}/lots`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLots(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [tender.id])

  useEffect(() => { load() }, [load])

  const saveDraft = async () => {
    const name = String(draft.lot_name || '').trim()
    if (!name) { alert('Nhập tên lô.'); return }
    setBusy(true)
    const body = {
      lot_name: name, lot_code: draft.lot_code, estimate: draft.estimate,
      result: draft.result || null, note: draft.note,
    }
    try {
      const url = draft.id ? `${API}/tender/lots/${draft.id}` : `${API}/tender/${tender.id}/lots`
      const method = draft.id ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Lỗi lưu')
      setDraft(null)
      load()
      onChanged?.()
    } catch (e) {
      alert('Lỗi: ' + e.message)
    } finally { setBusy(false) }
  }

  // Gói không chia lô: tạo thẳng 1 lô "Toàn gói" (kế thừa dự toán + kết quả của gói),
  // không hỏi form — để vào nhập nhà thầu luôn.
  const addWholePackageLot = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/tender/${tender.id}/lots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_name: 'Toàn gói', estimate: tender.estimate ?? '', result: tender.result || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Lỗi')
      load()
      onChanged?.()
    } catch (e) {
      alert('Lỗi: ' + e.message)
    } finally { setBusy(false) }
  }

  const deleteLot = async (lot) => {
    if (!confirm(`Xoá lô "${lot.lot_name}" cùng toàn bộ nhà thầu trong lô?`)) return
    try {
      const res = await fetch(`${API}/tender/lots/${lot.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      load()
      onChanged?.()
    } catch { alert('Không thể xoá lô.') }
  }

  if (loading) return <p className="dash-empty">Đang tải…</p>

  return (
    <div className="tlot">
      <div className="tlot-head">
        <span className="tlot-head-title">Lô / phần của gói thầu</span>
        {lots.length > 0 && (
          <span className="tlot-total">
            Tổng dự toán {lots.length} lô = dự toán gói:{' '}
            <strong>{fmtAmount(lots.reduce((s, l) => s + (Number(l.estimate) || 0), 0), ccy)}</strong>
          </span>
        )}
        <div className="tender-toolbar-spacer" />
        {canEdit && !draft && (
          <>
            {lots.length === 0 && (
              <button className="btn-secondary" onClick={addWholePackageLot} disabled={busy}>
                Gói không chia lô
              </button>
            )}
            {!isWholePackage && (
              <button className="btn-secondary" onClick={() => setDraft(emptyDraft())}>+ Thêm lô</button>
            )}
          </>
        )}
      </div>

      {draft && (
        <LotForm draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} busy={busy} ccy={ccy} />
      )}

      {lots.length === 0 && !draft && (
        <p className="dash-empty">Chưa khai báo lô nào. {canEdit ? 'Nhấn "Thêm lô" hoặc "Gói không chia lô" để bắt đầu.' : ''}</p>
      )}

      {lots.map(lot => {
        const rc = resultColor(lot.result)
        return (
          <div key={lot.id} className="tlot-card-section">
            <div className="tlot-lot-head">
              <div className="tlot-lot-titles">
                <span className="tlot-lot-name">{lot.lot_name}</span>
                {lot.lot_code && <span className="tlot-lot-code">{lot.lot_code}</span>}
                {rc && <span className="tender-badge" style={{ background: rc.bg, color: rc.fg }}>{lot.result}</span>}
              </div>
              <div className="tlot-lot-meta">
                {lot.estimate != null && (
                  <span>Dự toán: <strong>{fmtAmount(lot.estimate, ccy)}</strong>
                    {isForeign && rate > 0 ? ` (≈ ${fmtMoney(Math.round(Number(lot.estimate) * rate))} đ)` : ''}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="tlot-lot-actions">
                  <button className="btn-link" onClick={() => setDraft({
                    id: lot.id, lot_name: lot.lot_name || '', lot_code: lot.lot_code || '',
                    estimate: lot.estimate ?? '', result: lot.result || '', note: lot.note || '',
                    whole: lot.lot_name === 'Toàn gói',
                  })}>Sửa lô</button>
                  <button className="btn-link danger" onClick={() => deleteLot(lot)}>Xoá lô</button>
                </div>
              )}
            </div>
            {lot.note && <p className="tlot-lot-note">{lot.note}</p>}
            <TenderLotBidders
              tenderId={tender.id} lotId={lot.id} bidders={lot.bidders}
              canEdit={canEdit} ccy={ccy} rate={rate} isForeign={isForeign}
            />
          </div>
        )
      })}
    </div>
  )
}

function LotForm({ draft, setDraft, onSave, onCancel, busy, ccy }) {
  const set = (field, val) => setDraft(d => ({ ...d, [field]: val }))
  // Gói không chia lô (lô "Toàn gói"): tên/mã lô vô nghĩa → ẩn, chỉ sửa dự toán/kết quả/ghi chú.
  const whole = !!draft.whole
  return (
    <div className="tlot-form">
      <div className="tlot-form-grid">
        {!whole && (
          <label className="field">
            <span>Tên lô *</span>
            <input type="text" value={draft.lot_name} onChange={e => set('lot_name', e.target.value)} autoFocus />
          </label>
        )}
        {!whole && (
          <label className="field">
            <span>Mã lô</span>
            <input type="text" value={draft.lot_code} onChange={e => set('lot_code', e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Dự toán ({ccySuffix(ccy)})</span>
          <NumberInput value={draft.estimate ?? ''} placeholder="0" onChange={v => set('estimate', v)} />
        </label>
        <label className="field">
          <span>Kết quả</span>
          <select value={draft.result || ''} onChange={e => set('result', e.target.value)}>
            <option value="">— Chưa có —</option>
            {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field field--wide">
          <span>Ghi chú</span>
          <input type="text" value={draft.note} onChange={e => set('note', e.target.value)} />
        </label>
      </div>
      <div className="tlot-form-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Hủy</button>
        <button className="btn-primary" onClick={onSave} disabled={busy}>{busy ? 'Đang lưu…' : (draft.id ? 'Lưu lô' : 'Thêm lô')}</button>
      </div>
    </div>
  )
}
