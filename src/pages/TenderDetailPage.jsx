import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useTender, useTenderMembers, qk } from '../lib/queries'
import TenderInfoTab from '../components/tender/TenderInfoTab'
import TenderLotsTab from '../components/tender/TenderLotsTab'
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
  { key: 'bidders', label: 'Kết quả dự thầu' },
]

export default function TenderDetailPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('info')

  // Chi tiết gói + danh sách thành viên qua TanStack Query: nếu đã rê chuột ở danh sách thì
  // hiển thị NGAY từ cache. reload (gọi sau khi sửa tab con) = invalidate để tải lại ngầm.
  const { data: tender = null, isLoading: loading, isError } = useTender(id)
  const { data: members = [] } = useTenderMembers()
  const reload = () => queryClient.invalidateQueries({ queryKey: qk.tender(id) })

  const canAccess = Number(user?.role) === 1 || Number(user?.department_id) === 9
  if (!canAccess) return <Navigate to="/" replace />

  if (loading) return <main className="page admin-page"><p className="dash-empty">Đang tải…</p></main>
  if (isError || !tender) return <main className="page admin-page"><p className="dash-empty">Không tìm thấy gói thầu.</p></main>

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
            {tab === 'bidders' && (
              <TenderLotsTab tender={tender} canEdit={canEdit} onChanged={reload} />
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
