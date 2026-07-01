import './MobileEditSheet.css'
import { auditRowAttrs } from '../common/rowAudit'

// Mobile cho tab Xuất nhập khẩu: thẻ tóm tắt lô hàng, chạm để mở CustomsModal sẵn có.
export default function CustomsMobile({ rows, onEdit, onDelete, fmtVND, fmtDate, customsStatusStyle, totalCost, showAmounts = true }) {
  if (rows.length === 0) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Chưa có lô hàng nào. Nhấn <strong>Thêm lô hàng</strong>.</div>
  }
  return (
    <div className="mcards" style={{ padding: 12 }}>
      {rows.map((row, i) => {
        const st = customsStatusStyle(row.customs_status)
        const cost = totalCost(row)
        return (
          <div key={row.id} {...auditRowAttrs('contract_in_customs', row.id)} className="mcard" onClick={() => onEdit(row)}>
            <div className="mcard-head">
              <span className="mcard-title">{i + 1}. {row.bl_awb_no || row.declaration_no || `Lô #${row.id}`}</span>
              <span style={{ ...st, background: st.bg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{row.customs_status}</span>
            </div>
            <div className="mcard-meta">
              <span>{row.shipment_type}</span>
              {(row.port_of_loading || row.port_of_discharge) && <span>{row.port_of_loading || '—'} → {row.port_of_discharge || '—'}</span>}
              <span>ETA: {fmtDate(row.eta)}</span>
              {cost > 0 && <span>CP: {showAmounts ? `${fmtVND(cost)}đ` : '•••'}</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={e => { e.stopPropagation(); onDelete(row) }}
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
