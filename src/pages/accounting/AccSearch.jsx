import { useState, useMemo } from 'react'

// Ô tìm kiếm dùng chung cho các báo cáo kế toán: lọc client-side theo một số trường text.
// `fields` nên là hằng số ở mức module (mảng tên cột) để useMemo ổn định.
// eslint-disable-next-line react-refresh/only-export-components
export function useReportSearch(rows, fields) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => fields.some(f => {
      const v = r[f]
      return v != null && String(v).toLowerCase().includes(q)
    }))
  }, [rows, query, fields])
  return { query, setQuery, filtered }
}

// Ô nhập tìm kiếm, dùng lại style .acc-field trong Accounting.css.
export default function AccSearch({ value, onChange, placeholder = 'Tìm theo số HĐ, khách hàng...' }) {
  return (
    <label className="acc-field">Tìm kiếm
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} style={{ width: 220 }} />
    </label>
  )
}
