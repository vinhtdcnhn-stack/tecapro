import { useState, useEffect, useCallback } from 'react'

import { API } from '../../config/api'
import { thStyle, tdStyle, fmtDate, fmtNum, statusCfg } from './contractInUtils'
import ContractInDetail from './ContractInDetail'
import ContractInFormModal from './ContractInFormModal'
import ContractInCard from './ContractInCard'
import useIsMobile from './useIsMobile'
import { ContractPermProvider } from '../../context/ContractPermContext'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInTab({ contractId, initialContractInId, initialTab, currentUser, contract }) {
  const [items, setItems]           = useState([])
  const [suppliers, setSuppliers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedItem, setSelected] = useState(null)  // null = list; item = detail
  const [addModalOpen, setAddModal] = useState(false)
  const [search, setSearch]         = useState('')
  const [autoOpened, setAutoOpened] = useState(false)
  const isMobile                    = useIsMobile()

  // Phân quyền HĐ nhập (khớp chốt chặn server-side):
  //   - TẠO: admin / PM / Xuất nhập khẩu của HĐ bán.
  //   - GHI một HĐ nhập: admin HOẶC là người tạo (created_by) HĐ nhập đó.
  //   - Serial: thêm Kỹ thuật của HĐ bán.
  const isAdmin   = Number(currentUser?.role) === 1
  const myId      = currentUser ? String(currentUser.id) : null
  const memberIds = (key) => (contract?.[key] || []).map(String)
  const isPmMember = !!myId && memberIds('pm_member_ids').includes(myId)
  const isImportExportMember = !!myId && memberIds('import_export_member_ids').includes(myId)
  const isTechnicalMember    = !!myId && memberIds('technical_member_ids').includes(myId)
  const canCreate   = isAdmin || isPmMember || isImportExportMember
  const canEditItem = (item) => isAdmin || (!!myId && String(item?.created_by) === myId)

  const load = useCallback(async () => {
    try {
      const [iRes, sRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/contract-ins`),
        fetch(`${API}/suppliers`),
      ])
      const [iData, sData] = await Promise.all([iRes.json(), sRes.json()])
      setItems(Array.isArray(iData) ? iData : [])
      setSuppliers(Array.isArray(sData) ? sData : [])
    } catch (e) { console.error('load contract-ins:', e) }
    finally { setLoading(false) }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // Deep-link từ dashboard: tự mở đúng HĐ nhập được yêu cầu (một lần).
  useEffect(() => {
    if (autoOpened || !initialContractInId || !items.length) return
    const found = items.find(c => String(c.id) === String(initialContractInId))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mở đúng HĐ theo deep-link một lần khi danh sách đã tải
    if (found) { setSelected(found); setAutoOpened(true) }
  }, [items, initialContractInId, autoOpened])

  // When returning from detail, refresh the specific item if edited
  function handleItemUpdated(updated) {
    setItems(prev => prev.map(x => x.id === updated.id ? updated : x))
    setSelected(updated)  // keep detail open with fresh data
  }

  async function handleAdd(form) {
    const res  = await fetch(`${API}/contracts/${contractId}/contract-ins`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
    setItems(prev => [data, ...prev])
    setAddModal(false)
  }

  async function handleDelete(item) {
    if (!confirm(`Xóa hợp đồng nhập "${item.contract_no || '(chưa có số)'}"?`)) return
    await fetch(`${API}/contract-ins/${item.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(x => x.id !== item.id))
    setSelected(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  // ── Detail view ──────────────────────────────────────────────────────────────
  // Quyền GHI tính theo TỪNG HĐ nhập (người tạo) → override context PM ở ngoài.
  if (selectedItem) {
    const canEditThis = canEditItem(selectedItem)
    return (
      <ContractPermProvider canEdit={canEditThis} canEditSerial={canEditThis || isTechnicalMember}>
        <ContractInDetail
          item={selectedItem}
          suppliers={suppliers}
          initialTab={initialTab}
          onBack={() => setSelected(null)}
          onUpdate={handleItemUpdated}
          onDelete={handleDelete}
        />
      </ContractPermProvider>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const filtered    = items.filter(c => {
    const t = search.toLowerCase()
    return !t || c.contract_no?.toLowerCase().includes(t) ||
      c.goods_type?.toLowerCase().includes(t) ||
      c.supplier_name?.toLowerCase().includes(t)
  })
  const totalAmount = items.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const active      = items.filter(c => c.status === 'Active').length
  const completed   = items.filter(c => c.status === 'Completed').length

  return (
    <div style={{ padding: '20px 24px', minWidth: 0 }}>
      <div className="page-header" style={isMobile ? { marginBottom: 12 } : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="page-title" style={{ margin: 0 }}>HỢP ĐỒNG NHẬP</h1>
          {isMobile && canCreate && (
            <button
              className="btn-primary"
              onClick={() => setAddModal(true)}
              title="Thêm HĐ nhập"
              aria-label="Thêm HĐ nhập"
              style={{ padding: '8px 10px', flexShrink: 0 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
        {!isMobile && <p className="page-subtitle">Danh sách hợp đồng đầu vào thuộc hợp đồng bán này</p>}
      </div>

      {!isMobile && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card"><p className="stat-label">Tổng HĐ nhập</p><p className="stat-value">{items.length}</p></div>
          <div className="stat-card"><p className="stat-label">Đang thực hiện</p><p className="stat-value text-green-600">{active}</p></div>
          <div className="stat-card"><p className="stat-label">Hoàn thành</p><p className="stat-value text-blue-600">{completed}</p></div>
          <div className="stat-card"><p className="stat-label">Tổng giá trị (VNĐ)</p><p className="stat-value money">{fmtNum(totalAmount)} ₫</p></div>
        </div>
      )}

      {!isMobile && (
        <div className="flex items-center justify-between mb-4" style={{ gap: 12 }}>
          {canCreate ? (
            <button className="btn-primary" onClick={() => setAddModal(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Thêm HĐ nhập
            </button>
          ) : <span />}
          <input type="text" className="search-input"
            placeholder="🔍 Tìm số HĐ, loại hàng hóa, nhà cung cấp..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {!isMobile && (
        <div className="mb-2 text-sm text-gray-500">
          Hiển thị: <span className="font-medium text-gray-700">{filtered.length}</span> / {items.length} hợp đồng nhập
        </div>
      )}

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 10 }}>
              Chưa có hợp đồng nhập nào.{canCreate && ' Nhấn "Thêm HĐ nhập" để tạo mới.'}
            </div>
          ) : filtered.map(c => (
            <ContractInCard key={c.id} item={c} onOpen={() => setSelected(c)} />
          ))}
        </div>
      ) : (
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={thStyle('52px', 'center')}>Quản trị</th>
              <th style={thStyle('130px')}>Số HĐ nhập</th>
              <th style={thStyle('180px')}>Loại hàng hóa</th>
              <th style={thStyle('100px')}>Ngày HĐ</th>
              <th style={thStyle('200px')}>Nhà cung cấp</th>
              <th style={thStyle('140px', 'right')}>Giá trị</th>
              <th style={thStyle('70px', 'center')}>Tiền tệ</th>
              <th style={thStyle('90px', 'right')}>Tỷ giá</th>
              <th style={thStyle('110px', 'center')}>Loại mua hàng</th>
              <th style={thStyle('120px', 'center')}>Trạng thái</th>
            </tr>
          </thead>
          <tbody style={{ background: '#fff' }}>
            {filtered.length === 0 ? (
              <tr><td colSpan="10" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                Chưa có hợp đồng nhập nào. Nhấn <strong>Thêm HĐ nhập</strong> để tạo mới.
              </td></tr>
            ) : filtered.map(c => {
              const sc = statusCfg[c.status] || { label: c.status, cls: '' }
              return (
                <tr key={c.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={tdStyle('center')}>
                    <button className="btn-manage" onClick={() => setSelected(c)} title="Quản trị hợp đồng nhập">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </td>
                  <td style={tdStyle('left', { fontWeight: 600 })}>{c.contract_no || '-'}</td>
                  <td style={tdStyle('left', { whiteSpace: 'normal', maxWidth: 200 })}>{c.goods_type || '-'}</td>
                  <td style={tdStyle()}>{fmtDate(c.contract_date)}</td>
                  <td style={tdStyle()}>{c.supplier_name || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td style={tdStyle('right', { fontWeight: 600 })}>{fmtNum(c.amount, c.currency_code)}</td>
                  <td style={tdStyle('center', { color: '#6b7280' })}>{c.currency_code}</td>
                  <td style={tdStyle('right', { color: '#6b7280' })}>
                    {c.exchange_rate ? new Intl.NumberFormat('vi-VN').format(c.exchange_rate) : '—'}
                  </td>
                  <td style={tdStyle('center')}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: c.purchase_type === 'Nhập khẩu' ? '#ede9fe' : '#dbeafe',
                      color: c.purchase_type === 'Nhập khẩu' ? '#6d28d9' : '#1d4ed8',
                    }}>{c.purchase_type}</span>
                  </td>
                  <td style={tdStyle('center')}>
                    <span className={`status-badge ${sc.cls}`}>{sc.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {addModalOpen && (
        <ContractInFormModal
          suppliers={suppliers}
          onSave={handleAdd}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  )
}
