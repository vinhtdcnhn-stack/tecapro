import { useParams } from 'react-router-dom'
import ContractManagementPage from './ContractManagementPage'

export default function QldaDetailPage() {
  const { id } = useParams()

  return (
    <main className="page admin-page">
      <div className="contract-management-layout">
        <ContractManagementPage selectedContractId={Number(id)} />
      </div>
    </main>
  )
}
