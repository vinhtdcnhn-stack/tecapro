import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useRegisterSectionNav } from '../context/SectionNavContext'
import ApprovalSidebar from '../components/approvals/ApprovalSidebar'
import { APPROVAL_BASE, APPROVAL_GROUPS } from '../components/approvals/approvalNav'
import FormList from '../components/approvals/admin/FormList'
import RequestList from '../components/approvals/RequestList'
import Inbox from '../components/approvals/Inbox'
import RequestBrowseList from '../components/approvals/RequestBrowseList'
import AllRequests from '../components/approvals/admin/AllRequests'
import '../components/approvals/Approval.css'

const VALID = ['my', 'inbox', 'upcoming', 'following', 'all', 'forms']
const ADMIN_ONLY = ['all', 'forms']

export default function ApprovalPage() {
  const { user } = useAuth()
  const { has } = usePermission()
  const { section } = useParams()

  // Quản trị biểu mẫu / xem mọi đơn theo RBAC lớp A (admin fail-open).
  const canManage = has('approvals.forms.manage')
  const validSection = VALID.includes(section)

  // Đăng ký thanh chọn mục cho Header (nút icon hiện trên mobile — thay sidebar bị ẩn).
  // Gọi vô điều kiện (Rules of Hooks); truyền null khi không ở màn hợp lệ.
  useRegisterSectionNav(
    user && validSection
      ? {
          base: APPROVAL_BASE,
          current: section,
          items: APPROVAL_GROUPS
            .flatMap(g => g.items)
            .filter(i => !i.adminOnly || canManage)
            .map(i => ({ label: i.label, value: i.section })),
        }
      : null
  )

  // Toàn công ty: mọi nhân viên đã đăng nhập đều dùng được.
  if (!user) return <Navigate to="/login" replace />
  if (!validSection) return <Navigate to="/de-xuat/my" replace />
  // Chặn truy cập section quản trị nếu không phải admin.
  if (ADMIN_ONLY.includes(section) && !canManage) return <Navigate to="/de-xuat/my" replace />

  return (
    <main className="page admin-page approval-page">
      <div className="admin-layout">
        <ApprovalSidebar canManage={canManage} />
        <section className="content-area">
          {section === 'my' && <RequestList />}
          {section === 'inbox' && <Inbox />}
          {section === 'upcoming' && (
            <RequestBrowseList
              title="SẮP ĐẾN LƯỢT TÔI"
              endpoint="/approvals/requests/upcoming"
              emptyText="Không có đơn nào sắp đến lượt bạn duyệt."
              dateField="submitted_at"
              dateLabel="Ngày gửi"
            />
          )}
          {section === 'following' && (
            <RequestBrowseList
              title="TÔI THEO DÕI"
              endpoint="/approvals/requests/following"
              emptyText="Bạn không theo dõi đơn nào."
              dateField="created_at"
              dateLabel="Ngày tạo"
            />
          )}
          {section === 'all' && <AllRequests />}
          {section === 'forms' && <FormList />}
        </section>
      </div>
    </main>
  )
}
