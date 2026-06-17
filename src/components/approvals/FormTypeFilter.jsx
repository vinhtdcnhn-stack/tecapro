import { useMemo, useState } from 'react'

// Hook lọc danh sách đơn theo loại đề xuất. Tự sinh danh sách loại từ chính các dòng
// đang có (không cần gọi thêm API). Trả { formId, setFormId, options, filtered }.
// eslint-disable-next-line react-refresh/only-export-components
export function useFormTypeFilter(rows) {
  const [formId, setFormId] = useState('')
  const options = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const key = String(r.form_id)
      if (!m.has(key)) m.set(key, { id: r.form_id, name: r.form_name, icon: r.form_icon })
    }
    return [...m.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
  }, [rows])
  const filtered = useMemo(
    () => (formId ? rows.filter(r => String(r.form_id) === formId) : rows),
    [rows, formId]
  )
  return { formId, setFormId, options, filtered }
}

// Dropdown chọn loại đơn để lọc. Mặc định ẩn khi chỉ có ≤ 1 loại (không cần lọc);
// truyền alwaysShow để luôn hiện (vd thanh lọc tab quản trị cần nhất quán).
export default function FormTypeFilter({ value, onChange, options, alwaysShow = false }) {
  if (!alwaysShow && options.length <= 1) return null
  return (
    <label className="ar-filter">
      <span>Loại đơn:</span>
      <select className="ab-input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Tất cả</option>
        {options.map(o => (
          <option key={o.id} value={String(o.id)}>{o.icon ? `${o.icon} ` : ''}{o.name}</option>
        ))}
      </select>
    </label>
  )
}
