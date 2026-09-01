import { useState } from 'react'
import DateInput, { isoToDisplay } from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'
import { auditRowAttrs } from '../common/rowAudit'

const statusColor = (type) =>
  (type === 'overdue' || type === 'late') ? { bg: '#fee2e2', fg: '#b91c1c' } :
  (type === 'done' || type === 'ok')      ? { bg: '#dcfce7', fg: '#15803d' } :
  type === 'pending'                      ? { bg: '#dbeafe', fg: '#1d4ed8' } :
                                            { bg: '#f3f4f6', fg: '#6b7280' }

// Phiên bản mobile của Tiến độ theo biên bản: thẻ tóm tắt + sheet sửa đúng mốc.
export default function ProgressMobile({
  rows, bbTypes, baseOptions = [], forecasts, plannedDates = {}, getStatusInfo,
  set, setBase, setHdBase, saveRow, deleteRow, addRow, showBase = true, auditTable,
}) {
  const [editingKey, setEditingKey] = useState(null)
  const editing = rows.find(r => r._key === editingKey) || null

  const openAdd = () => setEditingKey(addRow())
  const onSave  = () => { if (editing) saveRow(editing); setEditingKey(null) }
  const onDel   = () => { if (editing) deleteRow(editing); setEditingKey(null) }

  const bbLabel = (row) => {
    const bb = bbTypes.find(t => String(t.id) === String(row.bb_type_id))
    return bb ? `${bb.code} – ${bb.name}` : '(chưa chọn loại)'
  }

  return (
    <div className="prog-mobile">
      <div className="mcards">
        {rows.map((row, i) => {
          const st = getStatusInfo(forecasts[row._key], row.actual_date)
          const c = statusColor(st.type)
          return (
            <div key={row._key} {...auditRowAttrs(auditTable, row.id)} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setEditingKey(row._key)}>
              <div className="mcard-head">
                {row._dirty && <span className="mcard-dot" title="Chưa lưu" />}
                <span className="mcard-title">{i + 1}. {bbLabel(row)}</span>
                {!row._isNew && (
                  <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                )}
              </div>
              <div className="mcard-meta">
                <span>{showBase ? 'Dự kiến' : 'Kế hoạch'}: {isoToDisplay(forecasts[row._key]) || '—'}</span>
                <span>Thực tế: {isoToDisplay(row.actual_date?.slice(0, 10)) || '—'}</span>
              </div>
            </div>
          )
        })}
        <button className="mcard-add" onClick={openAdd}>+ Thêm biên bản</button>
      </div>

      {editing && (
        <MobileEditSheet
          title={editing._isNew ? 'Thêm biên bản' : 'Sửa biên bản'}
          saving={editing._saving}
          onClose={() => setEditingKey(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label="Loại biên bản">
            <select value={editing.bb_type_id || ''} onChange={e => set(editing._key, 'bb_type_id', e.target.value)}>
              <option value="">— Chọn loại —</option>
              {bbTypes.map(t => <option key={t.id} value={t.id}>{t.code} – {t.name}</option>)}
            </select>
          </Field>
          {showBase && (
            <>
              <Field label="Số ngày (tính từ mốc gốc)">
                <input type="number" min="0" value={editing.offset_days ?? ''} placeholder="20"
                  onChange={e => set(editing._key, 'offset_days', e.target.value)} />
              </Field>
              <Field label="Mốc gốc">
                <select value={editing.base_anchor === 'contract' ? 'contract' : (editing.base_bb_type_id || '')}
                  onChange={e => setBase(editing._key, e.target.value)}>
                  <option value="">Biên bản trước</option>
                  <option value="contract">Ngày ký HĐ</option>
                  {baseOptions.filter(o => String(o.bb_type_id) !== String(editing.bb_type_id))
                    .map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                </select>
              </Field>
            </>
          )}
          {showBase ? (
            <>
              <Field label="Ngày theo HĐ — mốc gốc">
                <select value={editing.hd_base_anchor === 'contract' ? 'contract' : (editing.hd_base_bb_type_id || '')}
                  onChange={e => setHdBase(editing._key, e.target.value)}>
                  <option value="">Nhập ngày</option>
                  <option value="contract">Ngày ký HĐ</option>
                  {baseOptions.filter(o => String(o.bb_type_id) !== String(editing.bb_type_id))
                    .map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                </select>
              </Field>
              {(editing.hd_base_anchor === 'contract' || editing.hd_base_bb_type_id) ? (
                <>
                  <Field label="Ngày theo HĐ — số ngày từ mốc gốc">
                    <input type="number" min="0" value={editing.hd_offset_days ?? ''} placeholder="0"
                      onChange={e => set(editing._key, 'hd_offset_days', e.target.value)} />
                  </Field>
                  <div className="mcard-meta">Ngày theo HĐ (tự tính): <strong>{isoToDisplay(plannedDates[editing._key]) || '—'}</strong></div>
                </>
              ) : (
                <Field label="Ngày theo HĐ">
                  <DateInput value={editing.planned_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'planned_date', e.target.value)} />
                </Field>
              )}
              <div className="mcard-meta">Ngày dự kiến (tự tính): <strong>{isoToDisplay(forecasts[editing._key]) || '—'}</strong></div>
            </>
          ) : (
            <Field label="Ngày kế hoạch">
              <DateInput value={editing.planned_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'planned_date', e.target.value)} />
            </Field>
          )}
          <Field label="Ngày thực tế (đã ký)">
            <DateInput value={editing.actual_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'actual_date', e.target.value)} />
          </Field>
          <Field label="Nguyên nhân chậm trễ">
            <input value={editing.reason || ''} placeholder="(nếu có)" onChange={e => set(editing._key, 'reason', e.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <input value={editing.penalty_note || ''} placeholder="(nếu có)" onChange={e => set(editing._key, 'penalty_note', e.target.value)} />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
