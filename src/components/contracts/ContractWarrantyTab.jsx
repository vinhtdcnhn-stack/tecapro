import { useState, useEffect, useCallback } from 'react'
import './ContractWarrantyTab.css'

import { apiGet } from '../../lib/api'
import { useContractPerm } from '../../context/ContractPermContext'
import EquipmentSubTab from './WarrantyEquipmentSubTab'
import CasesSubTab from './WarrantyCasesSubTab'
import WarrantySerialSubTab from './WarrantySerialSubTab'
import { ActivitiesSubTab } from './WarrantyDisplaySubTabs'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractWarrantyTab({ contractId }) {
  const { canView }               = useContractPerm()
  const [subTab, setSubTab]       = useState('equipment')
  const [equipment, setEquipment] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [cases, setCases]         = useState([])
  const [allActivities, setAllAct]= useState([])
  const [loading, setLoading]     = useState(true)

  const loadEquipment = useCallback(async () => {
    const d = await apiGet(`/contracts/${contractId}/equipment`, { conditional: true })
    setEquipment(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadDeliveries = useCallback(async () => {
    const d = await apiGet(`/contracts/${contractId}/deliveries`, { conditional: true })
    setDeliveries(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadCases = useCallback(async () => {
    const d = await apiGet(`/contracts/${contractId}/warranty-cases`, { conditional: true })
    setCases(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadAllActivities = useCallback(async () => {
    const d = await apiGet(`/contracts/${contractId}/warranty-activities`, { conditional: true })
    setAllAct(Array.isArray(d) ? d : [])
  }, [contractId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading rồi chạy các loader async (Promise.all)
    setLoading(true)
    Promise.all([loadEquipment(), loadDeliveries(), loadCases(), loadAllActivities()])
      .finally(() => setLoading(false))
  }, [loadEquipment, loadDeliveries, loadCases, loadAllActivities])

  const SUBTABS = [
    { key: 'equipment', label: 'Thiết bị bàn giao' },
    { key: 'serials',   label: 'Quản lý Serial' },
    { key: 'cases',     label: `Case bảo hành${cases.filter(c=>c.status!=='Đóng'&&c.status!=='Hoàn thành').length>0 ? ` (${cases.filter(c=>c.status!=='Đóng'&&c.status!=='Hoàn thành').length})` : ''}` },
    { key: 'activities',label: 'Nhật ký xử lý' },
  ]

  if (loading) return <div className="wty-loading">Đang tải dữ liệu bảo hành...</div>

  return (
    <div className="wty-tab">
      <div className="wty-subtab-bar">
        {SUBTABS.filter(t => canView(`co.warranty.${t.key}.view`)).map(t => (
          <button key={t.key} className={`wty-subtab-btn ${subTab===t.key?'active':''}`} onClick={()=>setSubTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="wty-body">
        {subTab === 'equipment' && (
          <EquipmentSubTab
            contractId={contractId}
            equipment={equipment}
            setEquipment={setEquipment}
            reload={loadEquipment}
            deliveries={deliveries}
            reloadDeliveries={loadDeliveries}
          />
        )}
        {subTab === 'serials' && (
          <WarrantySerialSubTab
            contractId={contractId}
            equipment={equipment}
            setEquipment={setEquipment}
            reload={loadEquipment}
            deliveries={deliveries}
          />
        )}
        {subTab === 'cases' && (
          <CasesSubTab
            contractId={contractId}
            cases={cases}
            setCases={setCases}
            equipment={equipment}
            reload={() => { loadCases(); loadAllActivities() }}
          />
        )}
        {subTab === 'activities' && (
          <ActivitiesSubTab activities={allActivities} cases={cases} />
        )}
      </div>
    </div>
  )
}
