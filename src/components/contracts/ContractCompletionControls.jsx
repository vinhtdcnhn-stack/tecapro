import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '../../config/api'
import { qk } from '../../lib/queries'
import './ContractCompletion.css'

// Chốt "Hoàn thành" / mở lại "Đang thực hiện" cho HĐ bán (PATCH /contracts/:id/status).
// Chỉ Trưởng/Phó Ban Triển khai Dự án + admin (canToggle — server kiểm tra lại).
// Khi HĐ Hoàn thành, mọi nội dung (trừ phiếu/nhật ký bảo hành) bị khóa: server chặn bằng
// trigger (migration 108), giao diện vô hiệu nút ghi qua ContractPermProvider frozen.
function useToggleCompletion(contract) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const toggle = async (target) => {
    const msg = target === 'Completed'
      ? `Chuyển hợp đồng ${contract.contract_no} sang "Hoàn thành"?\n\nSau khi chuyển, KHÔNG AI sửa được bất kỳ nội dung nào của hợp đồng (bảng giá, tiến độ, công nợ, công việc, tài liệu, HĐ nhập...) — chỉ còn ghi được phiếu bảo hành. Muốn sửa phải chuyển về "Đang thực hiện".`
      : `Mở lại hợp đồng ${contract.contract_no} về "Đang thực hiện"?\n\nMọi người có quyền sẽ sửa được nội dung hợp đồng trở lại.`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/contracts/${contract.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert('Lỗi: ' + (data.error || 'Không đổi được trạng thái')); return }
      queryClient.invalidateQueries({ queryKey: qk.contract(contract.id) })
      queryClient.invalidateQueries({ queryKey: qk.contracts })
    } catch {
      alert('Có lỗi xảy ra khi đổi trạng thái hợp đồng')
    } finally {
      setBusy(false)
    }
  }
  return { busy, toggle }
}

// Dải báo khóa hiện trên MỌI tab khi HĐ đã Hoàn thành (+ nút mở lại cho người có quyền).
export function CompletedBanner({ contract, canToggle }) {
  const { busy, toggle } = useToggleCompletion(contract || {})
  if (contract?.status !== 'Completed') return null
  return (
    <div className="contract-completed-banner">
      <span>
        🔒 Hợp đồng đã <strong>Hoàn thành</strong> — mọi nội dung đã bị khóa, không ai sửa được
        (trừ phiếu bảo hành). Muốn sửa, Trưởng/Phó Ban Triển khai Dự án phải chuyển về "Đang thực hiện".
      </span>
      {canToggle && (
        <button type="button" disabled={busy} onClick={() => toggle('Active')}>
          ↩ Chuyển về Đang thực hiện
        </button>
      )}
    </div>
  )
}

// Nút chốt "Hoàn thành" ở tab Thông tin (chỉ hiện cho người có quyền, HĐ chưa Hoàn thành).
export function CompleteContractButton({ contract, canToggle }) {
  const { busy, toggle } = useToggleCompletion(contract || {})
  if (!canToggle || !contract || contract.status === 'Completed') return null
  return (
    <button type="button" className="btn-complete-contract" disabled={busy}
      onClick={() => toggle('Completed')} title="Chốt hợp đồng: khóa toàn bộ nội dung">
      ✅ Chuyển sang Hoàn thành
    </button>
  )
}
