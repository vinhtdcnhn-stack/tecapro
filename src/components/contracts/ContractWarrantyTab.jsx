import { useState, useEffect, useCallback } from 'react'
import './ContractWarrantyTab.css'

import { API } from '../../config/api'
import EquipmentSubTab from './WarrantyEquipmentSubTab'
import CasesSubTab from './WarrantyCasesSubTab'
import { SerialSubTab, ActivitiesSubTab } from './WarrantyDisplaySubTabs'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractWarrantyTab({ contractId }) {
  const [subTab, setSubTab]       = useState('equipment')
  const [equipment, setEquipment] = useState([])
  const [cases, setCases]         = useState([])
  const [allActivities, setAllAct]= useState([])
  const [loading, setLoading]     = useState(true)

  const loadEquipment = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/equipment`)
    const d   = await res.json()
    setEquipment(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadCases = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/warranty-cases`)
    const d   = await res.json()
    setCases(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadAllActivities = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/warranty-activities`)
    const d   = await res.json()
    setAllAct(Array.isArray(d) ? d : [])
  }, [contractId])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadEquipment(), loadCases(), loadAllActivities()])
      .finally(() => setLoading(false))
  }, [loadEquipment, loadCases, loadAllActivities])

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
        {SUBTABS.map(t => (
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
          />
        )}
        {subTab === 'serials' && (
          <SerialSubTab equipment={equipment} />
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
