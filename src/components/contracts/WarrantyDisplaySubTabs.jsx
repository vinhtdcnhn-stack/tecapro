import { fmtDate, fmtDT, warrantyStatus, activityIcon } from './warrantyUtils'

// ── Serial Sub-tab ────────────────────────────────────────────────────────────

export function SerialSubTab({ equipment }) {
  const withSerials = equipment.filter(e => e.has_serial && e.serials?.length > 0)
  const total = equipment.reduce((s, e) => s + (e.serials?.length || 0), 0)

  return (
    <>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Tổng cộng <strong>{total}</strong> serial từ <strong>{withSerials.length}</strong> loại thiết bị.
      </div>
      {withSerials.length === 0 ? (
        <div className="wty-empty">Chưa có serial nào được đăng ký. Vào tab <strong>Thiết bị bàn giao</strong> để thêm.</div>
      ) : withSerials.map(eq => {
        const ws = warrantyStatus(eq.warranty_to)
        return (
          <div key={eq.id} className="serial-group">
            <div className="serial-group-header">
              <span className="serial-group-name">
                {eq.name}
                <span className={`wty-badge ${ws.cls}`} style={{ marginLeft: 10 }}>{ws.label}</span>
              </span>
              <span className="serial-group-model">{eq.brand} {eq.model} — {eq.location||'Chưa có vị trí'}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>BH: {fmtDate(eq.warranty_from)} → {fmtDate(eq.warranty_to)}</span>
            </div>
            <div style={{ padding: '10px 16px' }}>
              <div className="serial-chips">
                {eq.serials.map(s => (
                  <span key={s.id} className="serial-chip" title={`Trạng thái: ${s.status}`}>
                    {s.serial_no}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Activities Sub-tab ────────────────────────────────────────────────────────

export function ActivitiesSubTab({ activities, cases }) {
  return (
    <>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Tổng cộng <strong>{activities.length}</strong> nhật ký từ <strong>{cases.length}</strong> case bảo hành.
      </div>
      {activities.length === 0 ? (
        <div className="wty-empty">Chưa có nhật ký xử lý nào. Mở một case bảo hành để bắt đầu ghi nhật ký.</div>
      ) : (
        <div className="wty-section">
          <div className="wty-section-header">
            <span className="wty-section-title">Nhật ký xử lý tổng hợp</span>
          </div>
          <div style={{ padding: '8px 18px' }}>
            <div className="activity-timeline">
              {activities.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot">{activityIcon(a.activity_type)}</div>
                  <div className="activity-content">
                    <div>
                      <span className="activity-case-ref">{a.case_no||'Case'}</span>
                      <span style={{ margin:'0 6px', color:'#d1d5db' }}>|</span>
                      <span className="activity-type-tag">{a.activity_type||'Cập nhật'}</span>
                      {a.description}
                    </div>
                    <div className="activity-meta" style={{ fontSize:11 }}>
                      <span style={{ color:'#6b7280' }}>{a.case_title}</span>
                      {a.performed_by && <> — <strong>{a.performed_by}</strong></>}
                      {' — '}{fmtDT(a.performed_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
