import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import TenderInfoTab from '../components/tender/TenderInfoTab'
import TenderChecklistTab from '../components/tender/TenderChecklistTab'
import ContractDocumentsTab from '../components/contracts/ContractDocumentsTab'
import { ContractPermProvider } from '../context/ContractPermContext'
import TenderReviewTab from '../components/tender/TenderReviewTab'
import TenderActivityTab from '../components/tender/TenderActivityTab'
import { isHeadUser } from '../components/tender/tenderUtils'
import '../components/tender/Tender.css'

const TABS = [
  { key: 'info', label: 'Thông tin chung' },
  { key: 'invitation', label: 'Hồ sơ mời thầu' },
  { key: 'checklist', label: 'Checklist công việc' },
  { key: 'review', label: 'Review & Comment' },
  { key: 'activity', label: 'Lịch sử' },
]

export default function TenderDetailPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [tender, setTender] = useState(null)
  const [members, setMembers] = useState([])
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const reload = useCallback(() => {
    fetch(`${API}/tender/${id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null } return r.ok ? r.json() : null })
      .then(d => { if (d) setTender(d) })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    reload()
    fetch(`${API}/tender/members`).then(r => r.ok ? r.json() : []).then(m => setMembers(Array.isArray(m) ? m : [])).catch(() => {})
  }, [reload])

  const canAccess = Number(user?.role) === 1 || Number(user?.department_id) === 9
  if (!canAccess) return <Navigate to="/" replace />

  if (loading) return <main className="page admin-page"><p className="dash-empty">Đang tải…</p></main>
  if (notFound || !tender) return <main className="page admin-page"><p className="dash-empty">Không tìm thấy gói thầu.</p></main>

  const isHead = isHeadUser(user, members)
  const canEdit = isHead || Number(tender.bid_maker_id) === Number(user?.id)

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <section className="content-area tender-detail">
          <div className="tender-detail-head">
            <button className="btn-link" onClick={() => navigate('/cong-viec/dau-thau/list')}>← Danh sách</button>
            <h2 className="section-title">{tender.package_name}</h2>
          </div>

          <div className="tender-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`tender-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="tender-tab-body">
            {tab === 'info' && (
              <TenderInfoTab tender={tender} members={members} isHead={isHead} canEdit={canEdit} onChanged={reload} />
            )}
            {tab === 'invitation' && (
              <ContractPermProvider canEdit={canEdit}>
                <ContractDocumentsTab contractId={tender.id} basePath={`tenders/${tender.id}`} allowRootUpload />
              </ContractPermProvider>
            )}
            {tab === 'checklist' && (
              <TenderChecklistTab tenderId={tender.id} members={members} canEdit={canEdit} />
            )}
            {tab === 'review' && (
              <TenderReviewTab tenderId={tender.id} canEdit={canEdit} isHead={isHead} />
            )}
            {tab === 'activity' && <TenderActivityTab tenderId={tender.id} />}
          </div>
        </section>
      </div>
    </main>
  )
}
