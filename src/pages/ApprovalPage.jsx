import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ApprovalSidebar from '../components/approvals/ApprovalSidebar'
import FormList from '../components/approvals/admin/FormList'
import RequestList from '../components/approvals/RequestList'
import Inbox from '../components/approvals/Inbox'
import { canManageForms } from '../components/approvals/approvalUtils'
import '../components/approvals/Approval.css'

const VALID = ['my', 'inbox', 'forms']

export default function ApprovalPage() {
  const { user } = useAuth()
  const { section } = useParams()

  // Toàn công ty: mọi nhân viên đã đăng nhập đều dùng được.
  if (!user) return <Navigate to="/login" replace />
  if (!VALID.includes(section)) return <Navigate to="/de-xuat/my" replace />

  const canManage = canManageForms(user)
  // Chặn truy cập section quản trị nếu không phải admin.
  if (section === 'forms' && !canManage) return <Navigate to="/de-xuat/my" replace />

  return (
    <main className="page admin-page approval-page">
      <div className="admin-layout">
        <ApprovalSidebar canManage={canManage} />
        <section className="content-area">
          {section === 'my' && <RequestList />}
          {section === 'inbox' && <Inbox />}
          {section === 'forms' && <FormList />}
        </section>
      </div>
    </main>
  )
}
