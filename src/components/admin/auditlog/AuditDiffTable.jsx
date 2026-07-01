import { fieldLabel, fmtValue } from './auditLabels'

// Hiển thị chi tiết một bản ghi nhật ký:
//  - U (Sửa): bảng các trường thay đổi với giá trị cũ → mới.
//  - I (Tạo): các giá trị khởi tạo (bỏ trường rỗng/khóa kỹ thuật).
//  - D (Xóa): ảnh chụp bản ghi trước khi xóa.
const HIDDEN_KEYS = new Set(['id', 'created_at', 'updated_at', 'search_vector', 'tsv'])

function entries(obj) {
  if (!obj) return []
  return Object.keys(obj)
    .filter(k => !HIDDEN_KEYS.has(k))
    .map(k => [k, obj[k]])
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
}

export default function AuditDiffTable({ row }) {
  const { op, before, after, changed_keys } = row

  if (op === 'U') {
    const keys = (changed_keys && changed_keys.length ? changed_keys : [])
      .filter(k => !HIDDEN_KEYS.has(k))
    if (!keys.length) return <div style={{ color: '#888', fontSize: 13 }}>Không có trường nào thay đổi.</div>
    return (
      <table className="audit-diff">
        <thead>
          <tr><th>Trường</th><th>Giá trị cũ</th><th></th><th>Giá trị mới</th></tr>
        </thead>
        <tbody>
          {keys.map(k => (
            <tr key={k}>
              <td className="audit-diff-field">{fieldLabel(k)}</td>
              <td className="audit-diff-old">{fmtValue(before?.[k])}</td>
              <td className="audit-diff-arrow">→</td>
              <td className="audit-diff-new">{fmtValue(after?.[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // I hoặc D — liệt kê giá trị bản ghi.
  const data = op === 'D' ? before : after
  const list = entries(data)
  if (!list.length) return <div style={{ color: '#888', fontSize: 13 }}>(không có dữ liệu)</div>
  return (
    <table className="audit-diff">
      <tbody>
        {list.map(([k, v]) => (
          <tr key={k}>
            <td className="audit-diff-field">{fieldLabel(k)}</td>
            <td colSpan={3}>{fmtValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
