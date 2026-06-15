import { useState, useEffect, useCallback, useMemo } from 'react'
import DateInput from '../contracts/DateInput'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import useIsMobile from '../contracts/useIsMobile'
import { API } from '../../config/api'
import { fmtDate } from './deptWorkUtils'

const todayIso = () => new Date().toISOString().slice(0, 10)
const firstOfMonthIso = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

// Buổi làm — mỗi buổi tính 4 giờ công (khớp với server).
const SHIFTS = [
  { key: 'dem_truoc', label: 'Đêm hôm trước' },
  { key: 'sang', label: 'Sáng' },
  { key: 'chieu', label: 'Chiều' },
  { key: 'toi', label: 'Buổi tối' },
]
const shiftLabels = (keys) => SHIFTS.filter(s => (keys || []).includes(s.key)).map(s => s.label).join(', ')

const blankForm = () => ({ id: null, log_date: todayIso(), task_id: '', description: '', shifts: [] })

// Nhật ký công việc hằng ngày của một người (đầu vào tính năng lực).
// canManage (head/deputy/admin): đổi user_id để xem nhật ký người khác.
export default function WorkLogView({ currentUser, members = [], canManage }) {
  const isMobile = useIsMobile()
  const [from, setFrom] = useState(firstOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [viewUser, setViewUser] = useState(currentUser?.id)
  const [logs, setLogs] = useState([])
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(null)            // null = đóng; object = đang nhập/sửa
  const [saving, setSaving] = useState(false)

  const isOwnView = Number(viewUser) === Number(currentUser?.id)

  // Danh sách người để xem: roster Ban + đảm bảo chính mình luôn có mặt
  // (để sau khi xem người khác vẫn quay lại nhật ký của mình được).
  const personOptions = useMemo(() => {
    const list = [...members]
    if (currentUser?.id && !list.some(m => Number(m.user_id) === Number(currentUser.id))) {
      list.unshift({ user_id: currentUser.id, full_name: `${currentUser.full_name || 'Tôi'} (tôi)` })
    }
    return list
  }, [members, currentUser])

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to, user_id: viewUser }).toString()
      const r = await fetch(`${API}/dept-work/logs?${qs}`)
      setLogs(r.ok ? await r.json() : [])
    } catch (e) { console.error('load logs:', e) }
  }, [from, to, viewUser])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`${API}/dept-work/tasks`).then(r => r.ok ? r.json() : []).then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function save() {
    const desc = form.description?.trim()
    if (!form.log_date) { alert('Vui lòng chọn ngày.'); return }
    if (!desc) { alert('Vui lòng nhập mô tả công việc.'); return }
    if (!(form.shifts || []).length) { alert('Vui lòng chọn ít nhất một buổi làm.'); return }
    // Chặn trùng khung giờ: một buổi trong ngày chỉ được thuộc một nhật ký.
    const taken = new Set(
      logs.filter(l => l.id !== form.id && l.log_date?.slice(0, 10) === form.log_date)
          .flatMap(l => l.shifts || []),
    )
    const dup = form.shifts.filter(s => taken.has(s))
    if (dup.length) {
      alert(`Khung giờ "${shiftLabels(dup)}" trong ngày đã có nhật ký khác. `
        + 'Nhiều việc trong cùng một buổi phải ghi chung vào một mô tả công việc.')
      return
    }
    setSaving(true)
    try {
      const body = {
        log_date: form.log_date,
        task_id: form.task_id || null,
        description: desc,
        shifts: form.shifts || [],
      }
      const res = await fetch(`${API}/dept-work/logs${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Lưu thất bại'); return }
      setForm(null)
      await load()
    } catch { alert('Có lỗi xảy ra.') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!form?.id || !confirm('Xóa dòng nhật ký này?')) return
    try {
      const res = await fetch(`${API}/dept-work/logs/${form.id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Xóa thất bại'); return }
      setForm(null)
      await load()
    } catch { alert('Có lỗi xảy ra.') }
  }

  const totalHours = logs.reduce((s, l) => s + Number(l.effort_hours || 0), 0)

  const formFields = form && (
    <>
      <Field label="Ngày">
        <DateInput value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
      </Field>
      <Field label="Công việc liên quan (tùy chọn)">
        <select value={form.task_id || ''} onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}>
          <option value="">— Không gắn việc —</option>
          {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </Field>
      <Field label="Mô tả công việc">
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Đã làm gì..." />
      </Field>
      <Field label="Buổi làm (mỗi buổi 4 giờ)">
        <div className="dw-shift-picker">
          {SHIFTS.map(s => {
            const on = (form.shifts || []).includes(s.key)
            return (
              <label key={s.key} className={`dw-shift-opt${on ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setForm(f => {
                    const cur = f.shifts || []
                    return { ...f, shifts: on ? cur.filter(k => k !== s.key) : [...cur, s.key] }
                  })}
                />
                {s.label}
              </label>
            )
          })}
        </div>
      </Field>
    </>
  )

  return (
    <div className="dw-log">
      <div className="dw-log-toolbar">
        <label>Từ <DateInput value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Đến <DateInput value={to} onChange={e => setTo(e.target.value)} /></label>
        {canManage && (
          <label>Người
            <select value={viewUser} onChange={e => setViewUser(Number(e.target.value))}>
              {personOptions.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
            </select>
          </label>
        )}
        <span className="dw-log-total">Tổng: <strong>{totalHours.toFixed(1)}</strong> giờ</span>
        {isOwnView && <button className="save-btn dw-log-add" onClick={() => setForm(blankForm())}>+ Ghi nhật ký</button>}
      </div>

      {logs.length === 0 ? (
        <p className="dash-empty">Chưa có nhật ký trong khoảng này.</p>
      ) : isMobile ? (
        <div className="dw-log-cards">
          {logs.map(l => (
            <div key={l.id} className="dw-log-card" onClick={() => isOwnView && setForm({ id: l.id, log_date: l.log_date?.slice(0, 10), task_id: l.task_id || '', description: l.description, shifts: l.shifts || [] })}>
              <div className="dw-log-card-top">
                <span>{fmtDate(l.log_date)}</span>
                <strong>{shiftLabels(l.shifts) || `${Number(l.effort_hours).toFixed(1)}h`}</strong>
              </div>
              <p className="dw-pre">{l.description}</p>
              {l.task_title && <span className="dw-chip">{l.task_title}</span>}
            </div>
          ))}
        </div>
      ) : (
        <table className="tracking-table dw-log-table">
          <thead>
            <tr><th>Ngày</th><th>Mô tả</th><th>Việc liên quan</th><th>Buổi</th><th className="num">Giờ</th>{isOwnView && <th></th>}</tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{fmtDate(l.log_date)}</td>
                <td className="dw-pre">{l.description}</td>
                <td>{l.task_title || '—'}</td>
                <td>{shiftLabels(l.shifts) || '—'}</td>
                <td className="num">{Number(l.effort_hours).toFixed(1)}</td>
                {isOwnView && (
                  <td><button className="dw-act-btn dw-log-edit" onClick={() => setForm({ id: l.id, log_date: l.log_date?.slice(0, 10), task_id: l.task_id || '', description: l.description, shifts: l.shifts || [] })}>Sửa</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {form && (
        isMobile ? (
          <MobileEditSheet
            title={form.id ? 'Sửa nhật ký' : 'Ghi nhật ký'}
            onClose={() => setForm(null)} onSave={save} onDelete={form.id ? remove : undefined} saving={saving}
          >
            {formFields}
          </MobileEditSheet>
        ) : (
          <div className="dw-log-form">
            <h4 className="dw-detail-title">{form.id ? 'Sửa nhật ký' : 'Ghi nhật ký mới'}</h4>
            <div className="dw-log-form-grid">{formFields}</div>
            <div className="dw-log-form-actions">
              {form.id && <button className="dw-del-btn" onClick={remove}>Xóa</button>}
              <div className="dw-log-form-spacer" />
              <button className="cancel-btn" onClick={() => setForm(null)}>Hủy</button>
              <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
