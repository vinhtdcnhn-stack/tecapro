import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useDeptTeams, useDeptMembers } from '../lib/queries'
import DeptWorkSidebar from '../components/deptwork/DeptWorkSidebar'
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
  if (!has('module.deptwork.view')) return <Navigate to="/" replace />
  if (!VALID.includes(section)) return <Navigate to="/cong-viec/kt-co-dien/board" replace />

  const canManage = canManageDeptWork(user)

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <DeptWorkSidebar canManage={canManage} />
        <section className="content-area">
          {section === 'board' && (
            <>
              <h2 className="section-title">CÔNG VIỆC — DỰ ÁN VÀ CHUYỂN GIAO CÔNG NGHỆ</h2>
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
