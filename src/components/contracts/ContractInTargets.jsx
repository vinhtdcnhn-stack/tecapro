import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import EditGuard from './EditGuard'
import { useContractPerm } from '../../context/ContractPermContext'

// Tập HĐ bán mà HĐ nhập này "nhập cho" (contract_in_target). 1 HĐ nhập có thể cung cấp hàng
// cho nhiều HĐ bán; danh sách này quyết định cột "Nhập cho" (bảng giá mua) chọn được hàng bán
// của những HĐ bán nào. HĐ bán gốc (home) luôn có mặt, không xóa được. HĐ bán đã có hàng gắn
// vào Theo dõi nhập hàng cũng không xóa được (phải bỏ ghép ở tab Bảng giá mua trước).
export default function ContractInTargets({ item }) {
  const { canEdit } = useContractPerm()
  const [targets, setTargets] = useState([])
  const [contracts, setContracts] = useState([])   // danh sách HĐ bán để chọn (theo quyền)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)

  const loadTargets = useCallback(async () => {
    try {
      const data = await apiGet(`/contract-ins/${item.id}/targets`)
      setTargets(Array.isArray(data) ? data : [])
    } catch (e) { console.error('load targets:', e) }
  }, [item.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadTargets là async: setState sau await, không phải cascade đồng bộ
  useEffect(() => { loadTargets() }, [loadTargets])

  // Danh sách HĐ bán cho ô tìm — chỉ nạp khi user có quyền sửa (mới cần thêm).
  useEffect(() => {
    if (!canEdit) return
    apiGet('/contracts', { conditional: true })
      .then(d => setContracts(Array.isArray(d) ? d : []))
      .catch(() => setContracts([]))
  }, [canEdit])

  // Đóng dropdown khi click ra ngoài.
  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const linkedIds = useMemo(() => new Set(targets.map(t => String(t.contract_out_id))), [targets])
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase()
    if (!t) return []
    return contracts
      .filter(c => !linkedIds.has(String(c.id)))
      .filter(c => c.contract_no?.toLowerCase().includes(t) || c.project_name?.toLowerCase().includes(t))
      .slice(0, 20)
  }, [query, contracts, linkedIds])

  async function addTarget(contractOutId) {
    setBusy(true)
    try {
      const res = await fetch(`${API}/contract-ins/${item.id}/targets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_out_id: contractOutId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'Lỗi thêm HĐ bán'); return }
      setQuery(''); setOpen(false)
      await loadTargets()
    } finally { setBusy(false) }
  }

  async function removeTarget(t) {
    if (!confirm(`Bỏ liên kết HĐ bán "${t.contract_no || t.contract_out_id}" khỏi hợp đồng nhập này?`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/contract-ins/${item.id}/targets/${t.contract_out_id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'Lỗi bỏ liên kết'); return }
      await loadTargets()
    } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 720, marginTop: 28, paddingTop: 20, borderTop: '1px solid #eef0f2' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>
        HĐ bán được cung cấp (Nhập cho)
      </h3>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 14px' }}>
        Hợp đồng nhập này cung cấp hàng cho các HĐ bán dưới đây. Cột “Nhập cho” ở tab Bảng giá mua
        sẽ chọn được hàng bán của mọi HĐ bán trong danh sách.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {targets.map(t => {
          const locked = t.is_home || t.has_links
          const reason = t.is_home
            ? 'HĐ bán gốc — không thể bỏ liên kết'
            : (t.has_links ? 'Đã có hàng gắn vào Theo dõi nhập hàng — bỏ ghép ở tab Bảng giá mua trước' : 'Bỏ liên kết')
          return (
            <div key={t.contract_out_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                  {t.contract_no || '(chưa có số)'}
                  {t.is_home && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#1d4ed8',
                      background: '#dbeafe', padding: '1px 8px', borderRadius: 99 }}>HĐ gốc</span>
                  )}
                </div>
                {t.project_name && (
                  <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.project_name}
                  </div>
                )}
              </div>
              <EditGuard>
                <button type="button" title={reason} disabled={locked}
                  onClick={() => removeTarget(t)}
                  style={{
                    border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    background: locked ? '#f3f4f6' : '#fee2e2', color: locked ? '#9ca3af' : '#b91c1c',
                  }}>✕</button>
              </EditGuard>
            </div>
          )
        })}
        {targets.length === 0 && (
          <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Chưa có HĐ bán nào.</div>
        )}
      </div>

      <EditGuard>
        <div ref={boxRef} style={{ position: 'relative', maxWidth: 420 }}>
          <input type="text" value={query} disabled={busy}
            placeholder="🔍 Thêm HĐ bán: gõ số HĐ hoặc tên dự án..."
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
          {open && query.trim() && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              maxHeight: 260, overflowY: 'auto',
            }}>
              {matches.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af' }}>Không tìm thấy HĐ bán phù hợp.</div>
              ) : matches.map(c => (
                <div key={c.id} onClick={() => addTarget(c.id)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.contract_no || '(chưa có số)'}</div>
                  {c.project_name && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.project_name}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </EditGuard>
    </div>
  )
}
