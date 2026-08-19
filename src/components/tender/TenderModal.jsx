import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import DateInput from '../contracts/DateInput'
import NumberInput from '../common/NumberInput'
import CustomerSelect from '../common/CustomerSelect'
import { API } from '../../config/api'
import { FIELDS, RESULTS, CURRENCIES, BID_STATUSES } from './tenderUtils'
import { selectableUsers, userLabel } from '../../lib/userStatus'

// Form tạo / sửa gói thầu (16 trường của bảng theo dõi). Trưởng phòng (isHead) phân
// công Người làm thầu & AM ngay tại form này; thành viên thường không thấy 2 trường đó.
const EMPTY = {
  package_name: '', package_code: '', customer_id: '', investor: '', estimate: '',
  currency_code: 'VND', exchange_rate: '', submit_date: '',
  field: '', guarantee: '', pakd_no: '', uq_no: '', assign_decision: '', note: '', result: '',
  bid_status: 'Đang làm thầu',
}

export default function TenderModal({ tender, members = [], isHead = false, onClose, onSaved }) {
  const editing = !!tender?.id
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(tender || {}),
    customer_id: tender?.customer_id ?? '',
    estimate: tender?.estimate ?? '',
    currency_code: tender?.currency_code || 'VND',
    exchange_rate: tender?.exchange_rate ?? '',
    submit_date: tender?.submit_date ? String(tender.submit_date).slice(0, 10) : '',
    result: tender?.result || '',
  }))
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [bidMaker, setBidMaker] = useState(tender?.bid_maker_id || '')
  const [am, setAm] = useState(tender?.am_id || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Chủ đầu tư lấy từ CSDL hệ thống (bảng customer).
  useEffect(() => {
    fetch(`${API}/customers`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Danh sách người (cho ô phân công) chỉ cần khi là Trưởng phòng.
  useEffect(() => {
    if (!isHead) return
    fetch(`${API}/users`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]))
  }, [isHead])

  // Người làm thầu: ưu tiên thành viên phòng; AM: mọi người dùng.
  const memberIds = new Set(members.map(m => Number(m.user_id)))
  const bidOptions = users.filter(u => memberIds.has(Number(u.id)))
  const bidList = bidOptions.length ? bidOptions : users

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const foreign = form.currency_code && form.currency_code !== 'VND'

  async function handleSave() {
    if (!form.package_name.trim()) { setErr('Tên gói thầu không được để trống.'); return }
    if (foreign && !(Number(form.exchange_rate) > 0)) {
      setErr(`Nhập tỷ giá VNĐ/${form.currency_code} cho gói thầu ngoại tệ.`); return
    }
    setSaving(true); setErr('')
    try {
      const url = editing ? `${API}/tender/${tender.id}` : `${API}/tender`
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          exchange_rate: foreign ? form.exchange_rate : 1,
          ...(isHead ? { bid_maker_id: bidMaker || null, am_id: am || null } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.')
      onSaved?.(data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={760} labelledBy="tender-modal-title" className="tender-form-modal">
      <div className="modal-header">
        <h3 id="tender-modal-title">{editing ? 'Sửa gói thầu' : 'Thêm gói thầu'}</h3>
        <button className="modal-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      <div className="modal-body">
        {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
        <div className="tender-form-grid">
          <label className="field field--wide">
            <span>Tên gói thầu *</span>
            <input value={form.package_name} onChange={set('package_name')} autoFocus />
          </label>
          <label className="field"><span>Mã gói thầu</span>
            <input value={form.package_code} onChange={set('package_code')} /></label>
          <div className="field"><span>Chủ đầu tư</span>
            <CustomerSelect
              customers={customers}
              selectedId={form.customer_id}
              onChange={(id) => setForm(f => ({ ...f, customer_id: id }))}
            /></div>
          <label className="field"><span>Tiền tệ</span>
            <select value={form.currency_code} onChange={set('currency_code')}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>Dự toán ({form.currency_code})</span>
            <NumberInput value={form.estimate} onChange={set('estimate')} integer={!foreign} /></label>
          {foreign && (
            <label className="field"><span>Tỷ giá (VNĐ/{form.currency_code}) *</span>
              <NumberInput value={form.exchange_rate} onChange={set('exchange_rate')} /></label>
          )}
          <label className="field"><span>Ngày nộp</span>
            <DateInput value={form.submit_date} onChange={set('submit_date')} /></label>
          <label className="field"><span>Lĩnh vực</span>
            <select value={form.field} onChange={set('field')}>
              <option value="">—</option>
              {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select></label>
          <label className="field"><span>Bảo lãnh</span>
            <input value={form.guarantee} onChange={set('guarantee')} /></label>
          <label className="field"><span>Số PAKD</span>
            <input value={form.pakd_no} onChange={set('pakd_no')} /></label>
          <label className="field"><span>Số UQ</span>
            <input value={form.uq_no} onChange={set('uq_no')} /></label>
          <label className="field"><span>QĐ giao nhiệm vụ</span>
            <input value={form.assign_decision} onChange={set('assign_decision')} /></label>
          {isHead && (
            <label className="field"><span>Người làm thầu</span>
              <select value={bidMaker} onChange={e => setBidMaker(e.target.value)}>
                <option value="">— Chưa giao —</option>
                {selectableUsers(bidList, bidMaker).map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </select></label>
          )}
          {isHead && (
            <label className="field"><span>AM phụ trách</span>
              <select value={am} onChange={e => setAm(e.target.value)}>
                <option value="">— Không —</option>
                {selectableUsers(users, am).map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </select></label>
          )}
          <label className="field"><span>Trạng thái</span>
            <select value={form.bid_status} onChange={set('bid_status')}>
              {BID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label className="field"><span>Kết quả</span>
            <select value={form.result} onChange={set('result')}>
              <option value="">—</option>
              {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
            </select></label>
          <label className="field field--wide"><span>Ghi chú</span>
            <textarea rows={2} value={form.note} onChange={set('note')} /></label>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Hủy</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </Modal>
  )
}
