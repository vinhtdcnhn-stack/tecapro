import { useState, useEffect, useCallback } from 'react'
import './ContractSupplyCoverageTab.css'
import SupplyLeafRow from './SupplyLeafRow'
import { statusMeta } from './supplyCoverageUtils'
import { useCanEdit } from '../../context/ContractPermContext'
import { API } from '../../config/api'

// Tab "Theo dõi nhập hàng" (phía HĐ bán). CHỈ liệt kê các dòng hàng CẦN NHẬP
// (no_import_needed=false — cờ này đặt bên tab Bảng giá). PM tách "đầu bán" cho hàng
// cần phân cấp; mỗi HĐ nhập creator gán hàng vào qua cột "Nhập cho" bên bảng giá mua.
export default function ContractSupplyCoverageTab({ contractId }) {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const canEdit = useCanEdit()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/contracts/${contractId}/supply-coverage`)
      const d = await res.json()
      setLeaves(d && Array.isArray(d.leaves) ? d.leaves : [])
    } catch (e) { console.error('load supply coverage:', e) }
    finally { setLoading(false) }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const addSlot = async (boqId, vals) => {
    try {
      const res = await fetch(`${API}/contracts/${contractId}/supply-slots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boq_id: boqId, ...vals }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi')
      await load()
    } catch (e) { alert('Không thể thêm đầu bán: ' + e.message) }
  }

  const updateSlot = async (slotId, vals) => {
    try {
      const res = await fetch(`${API}/supply-slots/${slotId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi')
      await load()
    } catch (e) { alert('Không thể sửa đầu bán: ' + e.message) }
  }

  const deleteSlot = async (slotId) => {
    if (!confirm('Xóa đầu bán này? Các ghép nhập vào đầu này cũng bị gỡ.')) return
    try {
      const res = await fetch(`${API}/supply-slots/${slotId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi')
      await load()
    } catch (e) { alert('Không thể xóa đầu bán: ' + e.message) }
  }

  if (loading) return <div className="sc-loading">Đang tải theo dõi nhập hàng…</div>

  const counts = leaves.reduce((a, l) => { a[l.status] = (a[l.status] || 0) + 1; return a }, {})

  return (
    <div className="sc-tab">
      <div className="sc-header">
        <div className="sc-header-title">
          <h3>Theo dõi nhập hàng</h3>
          <p className="sc-muted">
            Chỉ hiện các dòng <strong>cần nhập</strong> (đánh dấu "không cần nhập" ở tab
            <strong> Bảng giá</strong>). Với hàng gồm nhiều thành phần mua từ nhiều HĐ nhập, tách
            thành các <strong>"đầu bán"</strong> (thành phần) để mỗi HĐ nhập gắn hàng vào đúng phần.
          </p>
        </div>
        <div className="sc-legend">
          {['none', 'partial', 'full'].map((s) => {
            const m = statusMeta(s)
            return (
              <span key={s} className="sc-legend-item">
                <span className="sc-dot" style={{ background: m.color }} />
                {m.label} ({counts[s] || 0})
              </span>
            )
          })}
        </div>
      </div>

      {leaves.length === 0 ? (
        <div className="sc-empty">
          Chưa có hàng hóa cần nhập. Thêm dòng ở tab <strong>Bảng giá</strong>, hoặc bỏ dấu
          "Không cần nhập" cho dòng cần theo dõi.
        </div>
      ) : (
        <div className="sc-list">
          {leaves.map((leaf) => (
            <SupplyLeafRow
              key={leaf.boq_id}
              leaf={leaf}
              canEdit={canEdit}
              onAddSlot={addSlot}
              onUpdateSlot={updateSlot}
              onDeleteSlot={deleteSlot}
            />
          ))}
        </div>
      )}
    </div>
  )
}
