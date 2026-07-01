import { useState, useEffect } from 'react'

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
import useIsMobile from './useIsMobile'
import { CinHeaderSlotContext } from './cinHeaderSlot'
import { setContractInSubTab } from '../permissions/activeSubTab'
import { SUB_TABS, fmtNum, statusCfg } from './contractInUtils'
import { useContractPerm } from '../../context/ContractPermContext'

// ── Detail view ───────────────────────────────────────────────────────────────

export default function ContractInDetail({ item, suppliers, initialTab, onBack, onUpdate, onDelete }) {
  const { canView, canSection } = useContractPerm()
  const showAmounts = canSection('ci.info.amounts')
  // Lọc sub-tab HĐ nhập theo quyền .view (lớp B). Thiếu quyền → ẩn tab đó.
  const subTabs = SUB_TABS.filter(t => canView(`ci.${t.key}.view`))
  const [activeTab, setActiveTab] = useState(
    initialTab && SUB_TABS.some(t => t.key === initialTab) ? initialTab : 'info'
  )
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [headerSlot, setHeaderSlot] = useState(null)
  const sc = statusCfg[item.status] || { label: item.status, cls: '' }
  const isMobile = useIsMobile()

  // Báo cho PermissionPanel (Ctrl+Shift+Q) biết sub-tab HĐ nhập đang mở để chỉ hiện
  // đúng quyền của tab đó. Xoá khi rời chi tiết HĐ nhập.
  useEffect(() => { setContractInSubTab(activeTab) }, [activeTab])
  useEffect(() => () => setContractInSubTab(null), [])

  // Ctrl+← / Ctrl+→: chuyển qua lại giữa các tab (bỏ qua khi đang gõ trong ô nhập).
  useEffect(() => {
    if (isMobile) return
    function isTyping(el) {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    function handleKeyDown(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (isTyping(e.target)) return
      e.preventDefault()
      setActiveTab(cur => {
        const i = SUB_TABS.findIndex(t => t.key === cur)
        if (i === -1) return cur
        const next = e.key === 'ArrowRight'
          ? (i + 1) % SUB_TABS.length
          : (i - 1 + SUB_TABS.length) % SUB_TABS.length
        return SUB_TABS[next].key
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobile])

  return (
    <CinHeaderSlotContext.Provider value={headerSlot}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Header card */}
      <div style={{
        padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {!isMobile && (
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
        )}

        {/* Mobile: nút mở danh sách tab — đặt bên TRÁI số HĐ */}
        {isMobile && (
          <button
            className="cin-tab-fab"
            onClick={() => setTabMenuOpen(true)}
            aria-label="Chọn tab hợp đồng nhập"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Tab</span>
          </button>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {item.contract_no || '(Chưa có số HĐ)'}
            </span>
            {!isMobile && (
              <>
                <span style={{ color: '#d1d5db', fontSize: 16 }}>|</span>
                <span style={{ fontSize: 14, color: '#4b5563', fontWeight: 500 }}>
                  {item.goods_type || '(Chưa có loại hàng hóa)'}
                </span>
              </>
            )}
          </div>
          {!isMobile && (
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
                {showAmounts ? `${fmtNum(item.amount, item.currency_code)} ${item.currency_code}` : '•••'}
              </span>
            )}
          </div>
          )}
        </div>

        {/* Mobile: slot thao tác của tab đang mở (vd nút "Thêm đợt nhận hàng") */}
        {isMobile && (
          <div ref={setHeaderSlot} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} />
        )}
      </div>

      {/* Mobile: drawer chọn tab */}
      {isMobile && tabMenuOpen && (
        <>
          <div className="cin-tab-backdrop" onClick={() => setTabMenuOpen(false)} />
          <div className="cin-tab-drawer">
            <div className="cin-tab-drawer-header">
              <span>Chọn tab</span>
              <button className="cin-tab-drawer-close" onClick={() => setTabMenuOpen(false)} aria-label="Đóng">×</button>
            </div>
            <button
              className="cin-tab-drawer-item cin-tab-drawer-back"
              onClick={() => { setTabMenuOpen(false); onBack() }}
            >
              ← Danh sách HĐ nhập
            </button>
            {subTabs.map(t => (
              <button
                key={t.key}
                className={`cin-tab-drawer-item ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(t.key); setTabMenuOpen(false) }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Sub-tab bar — ẩn trên mobile (vào từ trang chủ là đúng tab cần xem) */}
      {!isMobile && (
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb',
        padding: '0 24px', background: '#fff', overflowX: 'auto',
      }}>
        {subTabs.map(t => (
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
      )}

      {/* Tab content */}
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, padding: isMobile ? '10px 4px' : '24px',
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
    </CinHeaderSlotContext.Provider>
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
