import './ContractProgressTab.css'

import { getStatusInfo } from './progressUtils'
import useProgressRows from './useProgressRows'
import ProgressTable from './ProgressTable'
import useIsMobile from './useIsMobile'
import ProgressMobile from './ProgressMobile'
import EditGuard from './EditGuard'

// ── Tiến độ theo biên bản — HỢP ĐỒNG BÁN ──────────────────────────────────────
// Trạng thái/thao tác ở useProgressRows, bảng desktop ở ProgressTable (dùng chung
// với tab tiến độ của hợp đồng nhập).

export default function ContractProgressTab({ contractId }) {
  const p = useProgressRows({
    listPath:   `/contracts/${contractId}/progress`,
    createPath: `/contracts/${contractId}/progress`,
    itemPath:   (id) => `/progress/${id}`,
    infoPath:   `/contracts/${contractId}`,
  })
  const isMobile = useIsMobile()

  if (p.loading) return <div className="prog-loading">Đang tải...</div>

  return (
    <div className="prog-tab">

      {/* ── Toolbar ── */}
      <div className="prog-toolbar">
        <div className="prog-toolbar-left">
          <EditGuard perm="co.progress.manage">
            <button className="prog-btn prog-btn-primary" onClick={p.addRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm biên bản
            </button>
          </EditGuard>
        </div>
        <div className="prog-stats">
          <span className="stat-chip stat-total">{p.savedRows.length} biên bản</span>
          <span className="stat-chip stat-done">{p.doneCount} hoàn thành</span>
          {p.lateCount > 0 && <span className="stat-chip stat-late">{p.lateCount} trễ hạn</span>}
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── Vô hiệu hóa nhập/xóa khi không phải PM */}
      <EditGuard perm="co.progress.manage">
      {isMobile ? (
        <ProgressMobile
          auditTable="contract_out_progress"
          rows={p.rows} bbTypes={p.bbTypes} baseOptions={p.baseOptions}
          forecasts={p.forecasts} plannedDates={p.plannedDates}
          getStatusInfo={getStatusInfo}
          set={p.set} setBase={p.setBase} setHdBase={p.setHdBase}
          saveRow={p.saveRow} deleteRow={p.deleteRow} addRow={p.addRow}
        />
      ) : (
        <ProgressTable
          auditTable="contract_out_progress"
          rows={p.rows} bbTypes={p.bbTypes} baseOptions={p.baseOptions}
          plannedDates={p.plannedDates} forecasts={p.forecasts}
          set={p.set} setBase={p.setBase} setHdBase={p.setHdBase}
          saveRow={p.saveRow} deleteRow={p.deleteRow}
        />
      )}
      </EditGuard>
    </div>
  )
}
