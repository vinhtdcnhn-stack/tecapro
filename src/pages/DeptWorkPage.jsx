import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import DeptWorkSidebar from '../components/deptwork/DeptWorkSidebar'
import TaskBoard from '../components/deptwork/TaskBoard'
import WorkLogView from '../components/deptwork/WorkLogView'
import CapacityReport from '../components/deptwork/CapacityReport'
import { canManageDeptWork } from '../components/deptwork/deptWorkUtils'
import '../components/deptwork/DeptWork.css'

const VALID = ['board', 'logs', 'capacity']

export default function DeptWorkPage() {
  const { user } = useAuth()
  const { section } = useParams()
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])

  useEffect(() => {
    Promise.all([
      fetch(`${API}/dept-work/teams`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/dept-work/members`).then(r => r.ok ? r.json() : []),
    ]).then(([t, m]) => {
      setTeams(Array.isArray(t) ? t : [])
      setMembers(Array.isArray(m) ? m : [])
    }).catch(console.error)
  }, [])

  // Chỉ thành viên Ban KT Cơ điện (department 7) hoặc admin được vào module.
  const canAccess = Number(user?.role) === 1 || Number(user?.department_id) === 7
  if (!canAccess) return <Navigate to="/" replace />
  if (!VALID.includes(section)) return <Navigate to="/cong-viec/kt-co-dien/board" replace />

  const canManage = canManageDeptWork(user)

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <DeptWorkSidebar canManage={canManage} />
        <section className="content-area">
          {section === 'board' && (
            <>
              <h2 className="section-title">CÔNG VIỆC — BAN KT CƠ ĐIỆN</h2>
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
