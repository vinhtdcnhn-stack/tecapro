import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useDeptTeams, useDeptMembers } from '../lib/queries'
import { useRegisterSectionNav } from '../context/SectionNavContext'
import DeptWorkSidebar from '../components/deptwork/DeptWorkSidebar'
import { DEPTWORK_BASE, DEPTWORK_ITEMS } from '../components/deptwork/deptWorkNav'
import TaskBoard from '../components/deptwork/TaskBoard'
import WorkLogView from '../components/deptwork/WorkLogView'
import CapacityReport from '../components/deptwork/CapacityReport'
import { canManageDeptWork } from '../components/deptwork/deptWorkUtils'
import '../components/deptwork/DeptWork.css'

const VALID = ['board', 'logs', 'capacity']

export default function DeptWorkPage() {
  const { user } = useAuth()
  const { has } = usePermission()
  const { section } = useParams()
  const { data: teams = [] } = useDeptTeams()
  const { data: members = [] } = useDeptMembers()

  // RBAC chỉ gate "vào module" (admin fail-open). Bên trong (tab sidebar nào hiện, quyền quản
  // lý) theo hardcode: mọi người vào được thấy đủ 3 tab; canManageDeptWork lo phần quản lý.
  const canView = has('module.deptwork.view')
  const validSection = VALID.includes(section)
  const canManage = canManageDeptWork(user)

  // Đăng ký thanh chọn mục cho Header (nút icon hiện trên mobile — thay sidebar bị ẩn).
  // Gọi vô điều kiện (Rules of Hooks); truyền null khi không ở màn hợp lệ.
  useRegisterSectionNav(
    canView && validSection
      ? {
          base: DEPTWORK_BASE,
          current: section,
          items: DEPTWORK_ITEMS
            .filter(i => !i.manageOnly || canManage)
            .map(i => ({ label: i.label, value: i.section })),
        }
      : null
  )

  if (!canView) return <Navigate to="/" replace />
  if (!validSection) return <Navigate to="/cong-viec/kt-co-dien/board" replace />

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <DeptWorkSidebar canManage={canManage} />
        <section className="content-area">
          {section === 'board' && (
            <>
              {/* Tiêu đề đầy đủ chỉ hiện trên desktop; mobile dùng tiêu đề gọn "CÔNG VIỆC" trong toolbar của TaskBoard */}
              <h2 className="section-title dw-board-title">CÔNG VIỆC — DỰ ÁN VÀ CHUYỂN GIAO CÔNG NGHỆ</h2>
              <TaskBoard currentUser={user} members={members} teams={teams} canManage={canManage} />
            </>
          )}
          {section === 'logs' && (
            <>
              <h2 className="section-title">NHẬT KÝ CÔNG VIỆC</h2>
              <WorkLogView currentUser={user} members={members} canManage={canManage} />
            </>
          )}
          {section === 'capacity' && (
            <>
              <h2 className="section-title">NĂNG LỰC</h2>
              <CapacityReport canManage={canManage} />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
