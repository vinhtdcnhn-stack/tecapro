import MultiSelect from '../../common/MultiSelect'
import { STEP_RULES, APPROVER_SOURCES, CONDITION_MODES } from '../approvalUtils'

// Trình sửa chuỗi bước duyệt (controlled). Mỗi bước: tên, quy tắc, người duyệt, điều kiện chức danh.
// userOptions/positionOptions: [{ value: '<id>', label: '<tên>' }]. Hiện chỉ hỗ trợ người duyệt kiểu 'user'.
export default function StepEditor({ steps, onChange, userOptions, positionOptions = [] }) {
  function update(i, patch) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function addStep() {
    // Tự đặt tên mặc định để khỏi phải gõ; admin có thể sửa lại.
    onChange([...steps, { name: `Cấp duyệt ${steps.length + 1}`, rule: 'any', approver_source: 'fixed', approvers: [], condition_mode: 'always', condition_positions: [] }])
  }
  function removeStep(i) { onChange(steps.filter((_, idx) => idx !== i)) }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  // approvers lưu dạng [{ approver_type:'user', approver_ref:'<id>' }]; MultiSelect dùng mảng id string.
  function selectedIds(s) {
    return (s.approvers || []).map(a => String(a.approver_ref))
  }
  function setApprovers(i, ids) {
    update(i, { approvers: ids.map(id => ({ approver_type: 'user', approver_ref: String(id) })) })
  }

  return (
    <div className="ab-section">
      <div className="ab-section-head">
        <h3>Chuỗi bước duyệt (tuần tự)</h3>
        <button type="button" className="btn btn-sm" onClick={addStep}>+ Thêm bước</button>
      </div>
      {steps.length === 0 && <p className="approval-empty">Chưa có bước duyệt nào.</p>}
      {steps.map((s, i) => (
        <div key={i} className="ab-step">
          <div className="ab-step-head">
            <span className="ab-step-no">Bước {i + 1}</span>
            <input
              className="ab-input ab-grow"
              placeholder="Tên bước (vd: Trưởng phòng)"
              value={s.name}
              onChange={e => update(i, { name: e.target.value })}
            />
            <select className="ab-input" value={s.approver_source || 'fixed'} onChange={e => update(i, { approver_source: e.target.value })}>
              {Object.entries(APPROVER_SOURCES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <select className="ab-input" value={s.rule || 'any'} onChange={e => update(i, { rule: e.target.value })}>
              {Object.entries(STEP_RULES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <div className="ab-row-actions">
              <button type="button" className="ab-icon" title="Lên" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ab-icon" title="Xuống" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="ab-icon ab-danger" title="Xóa" onClick={() => removeStep(i)}>✕</button>
            </div>
          </div>
          {(s.approver_source || 'fixed') === 'fixed' && (
            <div className="ab-step-approvers">
              <label className="ab-sublabel">Người duyệt</label>
              <MultiSelect
                options={userOptions}
                selectedValues={selectedIds(s)}
                onChange={ids => setApprovers(i, ids)}
                placeholder="Gõ tên hoặc email để tìm…"
                inlineSearch
              />
            </div>
          )}
          {(s.approver_source) === 'direct_manager' && (
            <p className="ar-note ab-step-approvers">⤷ Hệ thống tự lấy <b>quản lý trực tiếp</b> của người gửi khi đơn được gửi.</p>
          )}
          {(s.approver_source) === 'requester_pick' && (
            <p className="ar-note ab-step-approvers">⤷ <b>Người gửi</b> sẽ chọn người duyệt ở bước này khi lập đề xuất.</p>
          )}
          <div className="ab-step-approvers">
            <label className="ab-sublabel">Áp dụng bước theo chức danh người gửi</label>
            <select
              className="ab-input"
              value={s.condition_mode || 'always'}
              onChange={e => update(i, { condition_mode: e.target.value, ...(e.target.value === 'always' ? { condition_positions: [] } : {}) })}
            >
              {Object.entries(CONDITION_MODES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            {(s.condition_mode && s.condition_mode !== 'always') && (
              <div style={{ marginTop: 6 }}>
                <MultiSelect
                  options={positionOptions}
                  selectedValues={s.condition_positions || []}
                  onChange={ids => update(i, { condition_positions: ids })}
                  placeholder="Chọn chức danh áp dụng/loại trừ…"
                  inlineSearch
                />
                <p className="ar-note" style={{ marginTop: 4 }}>
                  {s.condition_mode === 'include'
                    ? 'Bước này CHỈ áp dụng khi người gửi có một trong các chức danh trên (ngược lại bỏ bước).'
                    : 'Bước này KHÔNG áp dụng khi người gửi có một trong các chức danh trên (sẽ bỏ bước).'}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
