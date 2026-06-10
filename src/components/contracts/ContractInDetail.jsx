import { useState } from 'react'

import ContractDocumentsTab from './ContractDocumentsTab'
import ContractInBOQTab from './ContractInBOQTab'
import ContractInDeliveryTab from './ContractInDeliveryTab'
import ContractInSerialTab from './ContractInSerialTab'
import ContractInPayableTab from './ContractInPayableTab'
import ContractInProgressTab from './ContractInProgressTab'
import ContractInSupplierWarrantyTab from './ContractInSupplierWarrantyTab'
import ContractInGuaranteeTab from './ContractInGuaranteeTab'
import ContractInCustomsTab from './ContractInCustomsTab'
import ContractInLogisticsTab from './ContractInLogisticsTab'
import ContractInInfoTab from './ContractInInfoTab'
import { SUB_TABS, fmtNum, statusCfg } from './contractInUtils'

// ── Detail view ───────────────────────────────────────────────────────────────

export default function ContractInDetail({ item, suppliers, initialTab, onBack, onUpdate, onDelete }) {
  const [activeTab, setActiveTab] = useState(
    initialTab && SUB_TABS.some(t => t.key === initialTab) ? initialTab : 'info'
  )
  const sc = statusCfg[item.status] || { label: item.status, cls: '' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Header card */}
      <div style={{
        padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer',
            fontSize: 13, color: '#374151', fontWeight: 500, flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Danh sách
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {item.contract_no || '(Chưa có số HĐ)'}
            </span>
            <span style={{ color: '#d1d5db', fontSize: 16 }}>|</span>
            <span style={{ fontSize: 14, color: '#4b5563', fontWeight: 500 }}>
              {item.goods_type || '(Chưa có loại hàng hóa)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.supplier_name && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                🏢 {item.supplier_name}
              </span>
            )}
            <span className={`status-badge ${sc.cls}`} style={{ fontSize: 11 }}>{sc.label}</span>
            <span style={{
              padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: item.purchase_type === 'Nhập khẩu' ? '#ede9fe' : '#dbeafe',
              color: item.purchase_type === 'Nhập khẩu' ? '#6d28d9' : '#1d4ed8',
            }}>{item.purchase_type}</span>
            {item.amount > 0 && (
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                {fmtNum(item.amount, item.currency_code)} {item.currency_code}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb',
        padding: '0 24px', background: '#fff', overflowX: 'auto',
      }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '11px 16px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? '#16a34a' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #16a34a' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color .15s, border-color .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, padding: '24px',
        ...(activeTab === 'documents'
          ? { overflow: 'hidden', display: 'flex', flexDirection: 'column' }
          : { overflowY: 'auto', overflowX: 'hidden' }),
      }}>
        {activeTab === 'info' ? (
          <ContractInInfoTab
            item={item}
            suppliers={suppliers}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : activeTab === 'documents' ? (
          <ContractDocumentsTab
            contractId={item.id}
            basePath={`contract-ins/${item.id}`}
          />
        ) : activeTab === 'pricing' ? (
          <ContractInBOQTab contractInId={item.id} currency={item.currency_code || 'VND'} />
        ) : activeTab === 'delivery' ? (
          <ContractInDeliveryTab contractInId={item.id} />
        ) : activeTab === 'serials' ? (
          <ContractInSerialTab contractInId={item.id} />
        ) : activeTab === 'payment' ? (
          <ContractInPayableTab contractInId={item.id} />
        ) : activeTab === 'progress' ? (
          <ContractInProgressTab contractInId={item.id} />
        ) : activeTab === 'warranty' ? (
          <ContractInSupplierWarrantyTab contractInId={item.id} />
        ) : activeTab === 'guarantee' ? (
          <ContractInGuaranteeTab contractInId={item.id} />
        ) : activeTab === 'customs' ? (
          <ContractInCustomsTab contractInId={item.id} />
        ) : activeTab === 'logistics' ? (
          <ContractInLogisticsTab contractInId={item.id} />
        ) : (
          <PlaceholderTab label={SUB_TABS.find(t => t.key === activeTab)?.label} />
        )}
      </div>
    </div>
  )
}

// ── Placeholder cho các tab chưa làm ─────────────────────────────────────────

function PlaceholderTab({ label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', color: '#9ca3af', gap: 12,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 13 }}>Chức năng này sẽ được phát triển sau</div>
    </div>
  )
}
