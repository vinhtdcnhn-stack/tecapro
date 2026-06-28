import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useContracts, useUsers, useCustomers, qk } from '../lib/queries'
import { prefetchHotData } from '../lib/idlePrefetch'
import ContractListPage from '../components/contracts/ContractListPage'


export default function QldaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const enabled = !!user?.id

  // Dữ liệu lấy qua TanStack Query: render NGAY từ cache (nếu đã nạp sẵn / vào trước đó),
  // đồng thời làm mới ngầm. Backend lọc theo danh tính từ cookie phiên (req.user) nên
  // không truyền userId; chỉ hoãn gọi tới khi đã đăng nhập qua `enabled`.
  const { data: contracts = [] } = useContracts({ enabled })
  const { data: users = [] } = useUsers({ enabled })
  const { data: customers = [] } = useCustomers({ enabled })

  // Sau khi đăng nhập, tranh thủ lúc trình duyệt rảnh nạp sẵn dữ liệu dùng chung.
  useEffect(() => { if (enabled) prefetchHotData() }, [enabled])

  // Gọi sau khi thêm/sửa HĐ: làm mới danh sách trong cache (vẫn hiển thị bản cũ tới khi xong).
  const reloadContracts = () => queryClient.invalidateQueries({ queryKey: qk.contracts })

  return (
    <main className="page admin-page">
      <div className="admin-layout">
        <section className="content-area">
          <ContractListPage
            contracts={contracts}
            onManage={(c) => navigate(`/qlda/${c.id}`)}
            onLoadContracts={reloadContracts}
            currentUser={user}
            users={users}
            customers={customers}
          />
        </section>
      </div>
    </main>
  )
}
