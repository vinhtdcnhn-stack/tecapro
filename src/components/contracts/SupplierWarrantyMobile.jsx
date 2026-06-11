import './MobileEditSheet.css'
import { fmtDate, claimStatusStyle, warrantyExpiry } from './supplierWarrantyUtils'

// Mobile cho tab Bảo hành NCC. Sửa vẫn dùng WarrantyModal/ClaimModal sẵn có —
// thẻ chỉ tóm tắt + chạm để mở modal, kèm nút Xóa.

export function ClaimCardList({ rows, onEdit, onDelete }) {
  if (rows.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chưa có claim bảo hành nào.</div>
  return (
    <div className="mcards" style={{ padding: 12 }}>
      {rows.map((c, i) => {
        const cs = claimStatusStyle(c.status)
        return (
          <div key={c.id} className="mcard" onClick={() => onEdit(c)}>
            <div className="mcard-head">
              <span className="mcard-title">{i + 1}. {c.title}</span>
              <span style={{ ...cs, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{c.status}</span>
            </div>
            <div className="mcard-meta">
              {c.claim_no && <span>Mã: {c.claim_no}</span>}
              {c.warranty_item_name && <span>{c.warranty_item_name}</span>}
              <span>Báo: {fmtDate(c.reported_date)}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={e => { e.stopPropagation(); onDelete(c) }}
                style={{ padding: '5px 12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Xóa
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WarrantyCardList({ rows, onEdit, onDelete }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Chưa có dữ liệu bảo hành. Nhấn <strong>Khởi tạo từ nhận hàng</strong>.
      </div>
    )
  }
  return (
    <div className="mcards" style={{ padding: 12 }}>
      {rows.map((w, i) => {
        const ex = warrantyExpiry(w)
        return (
          <div key={w.id} className="mcard" onClick={() => onEdit(w)}>
            <div className="mcard-head">
              <span className="mcard-title">{i + 1}. {w.item_name}</span>
              {ex && <span style={{ background: ex.bg, color: ex.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{ex.label}</span>}
            </div>
            <div className="mcard-meta">
              {w.warranty_period_text && <span>{w.warranty_period_text}</span>}
              <span>HSD: {fmtDate(w.warranty_end)}</span>
              {w.has_guarantee && <span>Có bảo lãnh BH</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={e => { e.stopPropagation(); onDelete(w) }}
                style={{ padding: '5px 12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Xóa
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
