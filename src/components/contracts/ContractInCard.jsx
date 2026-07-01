import { fmtDate, fmtNum, statusCfg } from './contractInUtils'
import { useContractPerm } from '../../context/ContractPermContext'
import { auditRowAttrs } from '../common/rowAudit'

// Thẻ hiển thị một hợp đồng nhập trên mobile (thay cho hàng bảng).
// Bấm vào thẻ để mở chi tiết HĐ nhập.
export default function ContractInCard({ item, onOpen }) {
  const { canSection } = useContractPerm()
  const showAmounts = canSection('ci.info.amounts')
  const sc = statusCfg[item.status] || { label: item.status, cls: '' }
  const isImport = item.purchase_type === 'Nhập khẩu'

  return (
    <button
      onClick={onOpen}
      {...auditRowAttrs('contract_in', item.id)}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
          {item.contract_no || '(chưa có số)'}
        </span>
        <span className={`status-badge ${sc.cls}`} style={{ fontSize: 11, flexShrink: 0 }}>{sc.label}</span>
      </div>

      <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
        {item.goods_type || <span style={{ color: '#9ca3af' }}>— chưa có loại hàng hóa —</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#6b7280' }}>
        <Row label="Nhà cung cấp" value={item.supplier_name || '—'} />
        <Row label="Ngày HĐ" value={fmtDate(item.contract_date) || '—'} />
        <Row
          label="Giá trị"
          value={
            <span style={{ fontWeight: 600, color: '#111827' }}>
              {showAmounts ? `${fmtNum(item.amount, item.currency_code)} ${item.currency_code}` : '•••'}
            </span>
          }
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <span style={{
          display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
          background: isImport ? '#ede9fe' : '#dbeafe',
          color: isImport ? '#6d28d9' : '#1d4ed8',
        }}>{item.purchase_type}</span>
      </div>
    </button>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  )
}
