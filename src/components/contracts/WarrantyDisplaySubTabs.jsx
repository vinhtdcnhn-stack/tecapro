import { fmtDT, activityIcon } from './warrantyUtils'

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
