import { useState, useEffect } from 'react'
import { API } from '../../config/api'
import NumberInput from '../common/NumberInput'
import { useCopyMenu } from '../common/useCopyMenu'
import useCtrlSave from '../contracts/useCtrlSave'
import useIsMobile from '../contracts/useIsMobile'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import { fmtMoney, fmtAmount, ccySuffix, techResultColor, TECH_RESULTS } from './tenderUtils'

// Bảng nhà thầu dự thầu của MỘT lô. Xếp hạng giá tính trực tiếp (live) theo giá đang
// nhập — giá thấp nhất = #1, đồng giá → đồng hạng. Tóm tắt "giá của bạn đứng thứ mấy"
// lấy từ dòng được đánh dấu "Đơn vị của tôi". Sửa inline + Ctrl+S + menu sao chép +
// thẻ/sheet trên mobile (theo convention bảng liệt kê bản ghi).

let _ctr = 0
const tmpId = () => `b_tmp_${++_ctr}`

// { rankMap: _key→hạng, total: số đơn vị có giá }. Đồng giá → cùng hạng (RANK).
function computeRanks(rows) {
  const priced = rows.filter(r => r.bid_price !== '' && r.bid_price != null && isFinite(Number(r.bid_price)))
  const sorted = [...priced].sort((a, b) => Number(a.bid_price) - Number(b.bid_price))
  const rankMap = new Map()
  let rank = 0, prev = null, seen = 0
  for (const r of sorted) {
    seen++
    const p = Number(r.bid_price)
    if (prev === null || p !== prev) { rank = seen; prev = p }
    rankMap.set(r._key, rank)
  }
  return { rankMap, total: priced.length }
}

const seed = (list) => (Array.isArray(list) ? list : []).map(b => ({
  ...b, _key: String(b.id), _dirty: false, _isNew: false, _saving: false,
}))

export default function TenderLotBidders({ tenderId, lotId, bidders, canEdit, ccy, rate, isForeign }) {
  const [rows, setRows] = useState(() => seed(bidders))
  const isMobile = useIsMobile()
  const [sheetKey, setSheetKey] = useState(null)

  // Lô được render lại (parent reload với dữ liệu mới) → nạp lại danh sách nhà thầu.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ state cục bộ theo prop bidders khi parent tải lại
  useEffect(() => { setRows(seed(bidders)) }, [bidders])

  const { rankMap, total } = computeRanks(rows)

  const set = (key, field, val) => setRows(prev => prev.map(r => {
    if (r._key !== key) {
      // Chỉ 1 "đơn vị của tôi" mỗi lô → bật ở dòng này thì tắt các dòng khác.
      return field === 'is_self' && val ? { ...r, is_self: false, _dirty: true } : r
    }
    return { ...r, [field]: val, _dirty: true }
  }))

  const addRow = () => {
    const r = {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      bidder_name: '', bid_price: '', is_self: false, tech_result: '', note: '',
    }
    setRows(prev => [...prev, r])
    return r._key
  }

  const saveRow = async (row) => {
    if (!String(row.bidder_name || '').trim()) { alert('Nhập tên đơn vị trước khi lưu.'); return }
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      bidder_name: row.bidder_name,
      bid_price: row.bid_price,
      is_self: !!row.is_self,
      tech_result: row.tech_result || null,
      note: row.note,
    }
    try {
      const url = row._isNew ? `${API}/tender/lots/${lotId}/bidders` : `${API}/tender/bidders/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Lỗi lưu')
      setRows(prev => prev.map(r => r._key === row._key
        ? { ...r, id: saved.id ?? r.id, _dirty: false, _isNew: false, _saving: false }
        : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xoá nhà thầu "${row.bidder_name || '(chưa đặt tên)'}"?`)) return
    try {
      const res = await fetch(`${API}/tender/bidders/${row.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xoá nhà thầu.') }
  }

  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // Menu chuột phải/ấn giữ "Sao chép thông tin".
  const { getRowProps, copyMenu } = useCopyMenu(
    (r) => {
      const rk = rankMap.get(r._key)
      const lines = [
        `Nhà thầu: ${r.bidder_name || '(chưa đặt tên)'}${r.is_self ? ' (Đơn vị của tôi)' : ''}`,
        `Giá dự thầu: ${r.bid_price != null && r.bid_price !== '' ? fmtAmount(r.bid_price, ccy) : '—'}`,
        rk ? `Xếp hạng giá: ${rk}/${total}` : null,
        r.tech_result ? `Kỹ thuật: ${r.tech_result}` : null,
      ].filter(Boolean)
      return lines.join('\n')
    },
    (r) => r.bidder_name || '(chưa đặt tên)',
    () => `/cong-viec/dau-thau/goi/${tenderId}`,
  )

  // Dòng tóm tắt "giá của bạn đứng thứ mấy".
  const selfRow = rows.find(r => r.is_self)
  const selfRank = selfRow ? rankMap.get(selfRow._key) : null

  const vnd = (price) => (isForeign && rate > 0 && price != null && price !== '')
    ? `${fmtMoney(Math.round(Number(price) * rate))} đ` : ''

  const colCount = isForeign ? 7 : 6

  return (
    <div className="tlot-bidders">
      {selfRow ? (
        selfRank ? (
          <div className="tlot-self-summary">
            Giá của bạn: <strong>{fmtAmount(selfRow.bid_price, ccy)}</strong> — đứng thứ{' '}
            <strong>{selfRank}/{total}</strong> đơn vị
          </div>
        ) : (
          <div className="tlot-self-summary tlot-self-summary--muted">
            Đã đánh dấu đơn vị của bạn — nhập giá dự thầu để biết xếp hạng.
          </div>
        )
      ) : (
        <div className="tlot-self-summary tlot-self-summary--muted">
          Chưa đánh dấu đơn vị của bạn. Tích "Đơn vị của tôi" ở một dòng để biết giá của bạn đứng thứ mấy.
        </div>
      )}

      {isMobile ? (
        <div className="tlot-cards">
          {rows.length === 0 && <div className="tlot-empty">Chưa có nhà thầu nào.</div>}
          {rows.map(r => {
            const rk = rankMap.get(r._key)
            return (
              <div key={r._key} className={`tlot-card${r.is_self ? ' tlot-card--self' : ''}${r._dirty ? ' tlot-card--dirty' : ''}`}
                {...(canEdit ? { onClick: () => setSheetKey(r._key) } : {})} {...getRowProps(r)}>
                <div className="tlot-card-top">
                  <span className="tlot-rank">{rk ? `#${rk}` : '—'}</span>
                  <span className="tlot-card-name">{r.bidder_name || '(chưa đặt tên)'}</span>
                  {r.is_self && <span className="tlot-self-tag">Đơn vị của tôi</span>}
                </div>
                <div className="tlot-card-sub">
                  {r.bid_price != null && r.bid_price !== '' ? fmtAmount(r.bid_price, ccy) : '—'}
                  {vnd(r.bid_price) && <span className="tender-muted"> (≈ {vnd(r.bid_price)})</span>}
                  {r.tech_result && <TechBadge value={r.tech_result} />}
                </div>
              </div>
            )
          })}
          {canEdit && <button className="btn-secondary tlot-add" onClick={addRow}>+ Thêm nhà thầu</button>}
          {sheetKey && (() => {
            const row = rows.find(r => r._key === sheetKey)
            if (!row) return null
            return (
              <MobileEditSheet
                title={row.bidder_name || 'Nhà thầu'} saving={row._saving}
                onClose={() => setSheetKey(null)}
                onSave={async () => { await saveRow(row); setSheetKey(null) }}
                onDelete={async () => { await deleteRow(row); setSheetKey(null) }}
              >
                <BidderFields row={row} set={set} ccy={ccy} />
              </MobileEditSheet>
            )
          })()}
        </div>
      ) : (
        <div className="tlot-table-wrap">
          <table className="tlot-table">
            <thead>
              <tr>
                <th className="num">Hạng</th>
                <th>Đơn vị</th>
                <th className="num">Giá dự thầu ({ccySuffix(ccy)})</th>
                {isForeign && <th className="num">Quy đổi VNĐ</th>}
                <th>KT</th>
                <th>Ghi chú</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={colCount + (canEdit ? 1 : 0)} className="tlot-empty">Chưa có nhà thầu nào.</td></tr>
              ) : rows.map(r => {
                const rk = rankMap.get(r._key)
                return (
                  <tr key={r._key} className={`${r.is_self ? 'tlot-row--self' : ''}${r._dirty ? ' tlot-row--dirty' : ''}`}
                    {...getRowProps(r)}>
                    <td className="num tlot-rank-cell">{rk ? <span className="tlot-rank">#{rk}</span> : '—'}</td>
                    <td>
                      {canEdit ? (
                        <div className="tlot-name-cell">
                          <input type="text" value={r.bidder_name || ''} placeholder="Tên đơn vị"
                            onChange={e => set(r._key, 'bidder_name', e.target.value)} />
                          <label className="tlot-self-check" title="Đơn vị của tôi">
                            <input type="checkbox" checked={!!r.is_self}
                              onChange={e => set(r._key, 'is_self', e.target.checked)} /> tôi
                          </label>
                        </div>
                      ) : (
                        <span>{r.bidder_name}{r.is_self && <span className="tlot-self-tag">Đơn vị của tôi</span>}</span>
                      )}
                    </td>
                    <td className="num">
                      {canEdit
                        ? <NumberInput value={r.bid_price ?? ''} placeholder="0" onChange={v => set(r._key, 'bid_price', v)} />
                        : (r.bid_price != null ? fmtMoney(r.bid_price) : '—')}
                    </td>
                    {isForeign && <td className="num tender-muted">{vnd(r.bid_price) || '—'}</td>}
                    <td>
                      {canEdit ? (
                        <select value={r.tech_result || ''} onChange={e => set(r._key, 'tech_result', e.target.value)}>
                          <option value="">—</option>
                          {TECH_RESULTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (r.tech_result ? <TechBadge value={r.tech_result} /> : '—')}
                    </td>
                    <td>
                      {canEdit
                        ? <input type="text" value={r.note || ''} placeholder="Ghi chú…" onChange={e => set(r._key, 'note', e.target.value)} />
                        : (r.note || '')}
                    </td>
                    {canEdit && (
                      <td className="tlot-act">
                        {r._dirty && (
                          <button className="btn-link" disabled={r._saving} onClick={() => saveRow(r)}>
                            {r._saving ? '…' : 'Lưu'}
                          </button>
                        )}
                        <button className="btn-link danger" onClick={() => deleteRow(r)}>Xoá</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {canEdit && <button className="btn-secondary tlot-add" onClick={addRow}>+ Thêm nhà thầu</button>}
        </div>
      )}
      {copyMenu}
    </div>
  )
}

function TechBadge({ value }) {
  const c = techResultColor(value)
  if (!c) return null
  return <span className="tender-badge" style={{ background: c.bg, color: c.fg, marginLeft: 6 }}>{value}</span>
}

// Form sửa 1 nhà thầu trong bottom-sheet mobile.
function BidderFields({ row, set, ccy }) {
  return (
    <>
      <Field label="Tên đơn vị">
        <input type="text" value={row.bidder_name || ''} onChange={e => set(row._key, 'bidder_name', e.target.value)} />
      </Field>
      <Field label={`Giá dự thầu (${ccySuffix(ccy)})`}>
        <NumberInput value={row.bid_price ?? ''} placeholder="0" onChange={v => set(row._key, 'bid_price', v)} />
      </Field>
      <Field label="Đơn vị của tôi">
        <label className="tlot-self-check">
          <input type="checkbox" checked={!!row.is_self} onChange={e => set(row._key, 'is_self', e.target.checked)} /> Đây là công ty của tôi
        </label>
      </Field>
      <Field label="Kết quả kỹ thuật">
        <select value={row.tech_result || ''} onChange={e => set(row._key, 'tech_result', e.target.value)}>
          <option value="">—</option>
          {TECH_RESULTS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Ghi chú">
        <input type="text" value={row.note || ''} onChange={e => set(row._key, 'note', e.target.value)} />
      </Field>
    </>
  )
}
