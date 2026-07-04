import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useTenderMembers } from '../lib/queries'
import { useRegisterSectionNav } from '../context/SectionNavContext'
import TenderSidebar from '../components/tender/TenderSidebar'
import { TENDER_BASE, TENDER_ITEMS } from '../components/tender/tenderNav'
import TenderList from '../components/tender/TenderList'
import TenderReports from '../components/tender/TenderReports'
import TenderChecklistTemplate from '../components/tender/TenderChecklistTemplate'
import { isHeadUser } from '../components/tender/tenderUtils'
import '../components/tender/Tender.css'

const VALID = ['list', 'my', 'template', 'reports']

export default function TenderPage() {
  const { user } = useAuth()
  const { has } = usePermission()
  const { section } = useParams()
  const { data: members = [] } = useTenderMembers()

  // Vào module theo RBAC lớp A (admin fail-open). Trưởng ban (isHead) vẫn theo mô hình động.
  const canView = has('module.tender.view')
  const validSection = VALID.includes(section)
  const isHead = isHeadUser(user, members)

  // Đăng ký thanh chọn mục cho Header (nút icon hiện trên mobile — thay sidebar bị ẩn).
  // Gọi vô điều kiện (Rules of Hooks); truyền null khi không ở màn hợp lệ.
  useRegisterSectionNav(
    canView && validSection
      ? {
          base: TENDER_BASE,
          current: section,
          items: TENDER_ITEMS
            .filter(i => !i.headOnly || isHead)
            .map(i => ({ label: i.label, value: i.section })),
        }
      : null
  )

  if (!canView) return <Navigate to="/" replace />
  if (!validSection) return <Navigate to="/cong-viec/dau-thau/list" replace />

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <TenderSidebar isHead={isHead} />
        <section className="content-area">
          {/* Tiêu đề đầy đủ chỉ hiện desktop; mobile dùng ô chọn mục gọn ở TenderSidebar. */}
          {section === 'list' && (
            <>
              <h2 className="section-title tender-section-title">KẾ HOẠCH ĐẤU THẦU — DANH SÁCH GÓI</h2>
              <TenderList mode="all" isHead={isHead} members={members} />
            </>
          )}
          {section === 'my' && (
            <>
              <h2 className="section-title tender-section-title">VIỆC CỦA TÔI</h2>
              <TenderList mode="my" canCreate={false} />
            </>
          )}
          {section === 'template' && (
            <>
              <h2 className="section-title tender-section-title">MẪU CHECKLIST CÔNG VIỆC</h2>
              <TenderChecklistTemplate canEdit={isHead} />
            </>
          )}
          {section === 'reports' && (
            <>
              <h2 className="section-title tender-section-title">BÁO CÁO ĐẤU THẦU</h2>
              <TenderReports />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
