import { useParams, useSearchParams } from 'react-router-dom'
import ContractManagementPage from './ContractManagementPage'

export default function QldaDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()

  return (
    <main className="page admin-page">
      <div className="contract-management-layout">
        <ContractManagementPage
          selectedContractId={Number(id)}
          initialMenu={params.get('tab') || null}
          initialInId={params.get('inId') ? Number(params.get('inId')) : null}
          initialInTab={params.get('inTab') || null}
          initialTaskId={params.get('taskId') || null}
        />
      </div>
    </main>
  )
}
