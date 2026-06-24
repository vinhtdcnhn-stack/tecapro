import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import TenderSidebar from '../components/tender/TenderSidebar'
import TenderList from '../components/tender/TenderList'
import TenderReports from '../components/tender/TenderReports'
import TenderChecklistTemplate from '../components/tender/TenderChecklistTemplate'
import { isHeadUser } from '../components/tender/tenderUtils'
import '../components/tender/Tender.css'

const VALID = ['list', 'my', 'template', 'reports']

export default function TenderPage() {
  const { user } = useAuth()
  const { section } = useParams()
  const [members, setMembers] = useState([])

  useEffect(() => {
    fetch(`${API}/tender/members`)
      .then(r => r.ok ? r.json() : [])
      .then(m => setMembers(Array.isArray(m) ? m : []))
      .catch(() => setMembers([]))
  }, [])

  // Chỉ thành viên Ban Kế hoạch Đấu thầu (dept 9) hoặc admin được vào module.
  const canAccess = Number(user?.role) === 1 || Number(user?.department_id) === 9
  if (!canAccess) return <Navigate to="/" replace />
  if (!VALID.includes(section)) return <Navigate to="/cong-viec/dau-thau/list" replace />

  const isHead = isHeadUser(user, members)

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <TenderSidebar isHead={isHead} />
        <section className="content-area">
          {section === 'list' && (
            <>
              <h2 className="section-title">KẾ HOẠCH ĐẤU THẦU — DANH SÁCH GÓI</h2>
              <TenderList mode="all" isHead={isHead} members={members} />
            </>
          )}
          {section === 'my' && (
            <>
              <h2 className="section-title">VIỆC CỦA TÔI</h2>
              <TenderList mode="my" canCreate={false} />
            </>
          )}
          {section === 'template' && (
            <>
              <h2 className="section-title">MẪU CHECKLIST CÔNG VIỆC</h2>
              <TenderChecklistTemplate canEdit={isHead} />
            </>
          )}
          {section === 'reports' && (
            <>
              <h2 className="section-title">BÁO CÁO ĐẤU THẦU</h2>
              <TenderReports />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
