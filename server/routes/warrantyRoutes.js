import { Router } from 'express'
import * as c from '../controllers/warrantyController.js'
import * as imp from '../controllers/warrantyImportController.js'
import * as lookup from '../controllers/warrantyLookupController.js'
import * as del from '../controllers/contractOutDeliveryController.js'
import { contractPermFromParam, contractPermVia, contractPermViaBody, ownerOrTechVia } from '../middleware/contractAccess.js'

const router = Router()

// Quyền ghi theo sub-tab Bảo hành (RBAC lớp B; bootstrap = PM, tương đương pmVia cũ).
const EQUIP = 'co.warranty.equipment.manage'
const SER   = 'co.warranty.serials.manage'
const CASE  = 'co.warranty.cases.manage'
const ACT   = 'co.warranty.activities.manage'

// Tra cứu bảo hành theo serial — cross-contract có chủ đích, chỉ đọc
router.get('/warranty-lookup', lookup.lookupSerial)

// Đợt giao hàng (tách thiết bị bàn giao theo đợt). Dùng tiền tố /out-deliveries để
// không đụng /deliveries/:id của HĐ nhập.
router.get('/contracts/:id/deliveries',  del.getDeliveries)
router.post('/contracts/:id/deliveries', contractPermFromParam(EQUIP, 'id'), del.createDelivery)
router.put('/out-deliveries/:id',        contractPermVia(EQUIP, 'outDelivery'), del.updateDelivery)
router.delete('/out-deliveries/:id',     contractPermVia(EQUIP, 'outDelivery'), del.deleteDelivery)

// Equipment — ghi cần co.warranty.equipment.manage
router.get('/contracts/:id/equipment',        c.getEquipment)
router.post('/contracts/:id/equipment',       contractPermFromParam(EQUIP, 'id'), c.createEquipment)
router.post('/contracts/:id/equipment/import', contractPermFromParam(EQUIP, 'id'), imp.importEquipment)
router.put('/equipment/bulk-warranty',        contractPermViaBody(EQUIP, 'equipment'), c.bulkWarrantyEquipment)
router.put('/equipment/:id',                  contractPermVia(EQUIP, 'equipment'), c.updateEquipment)
router.delete('/equipment/:id',               contractPermVia(EQUIP, 'equipment'), c.deleteEquipment)

// Kiểm tra serial có trong hệ thống nhập chưa (chỉ đọc) — dùng khi thêm serial bàn giao
router.post('/serials/check-import',   c.checkImportSerials)

// Serials — ghi cần co.warranty.serials.manage
router.get('/equipment/:id/serials',   c.getSerials)
router.get('/serials/:id/components',   c.getSerialComponents)
router.post('/equipment/:id/serials',  contractPermVia(SER, 'equipment'), c.createSerial)
router.post('/contracts/:id/serials/import', contractPermFromParam(SER, 'id'), imp.importComponentSerials)
router.put('/serials/bulk-warranty',   contractPermViaBody(SER, 'serial'), c.bulkWarrantySerials)
router.post('/serials/bulk-delete',    contractPermViaBody(SER, 'serial'), c.bulkDeleteSerials)
router.post('/serials/:id/replace',    contractPermVia(SER, 'serial'), lookup.replaceSerial)
// HĐ NHẬP: thay serial đợt nhận — giữ creator-ownership (người tạo / Kỹ thuật HĐ bán cha)
router.post('/delivery-serials/:id/replace', ownerOrTechVia('deliverySerial'), lookup.replaceDeliverySerial)
router.put('/serials/:id',             contractPermVia(SER, 'serial'), c.updateSerial)
router.delete('/serials/:id',          contractPermVia(SER, 'serial'), c.deleteSerial)

// Warranty Cases — ghi cần co.warranty.cases.manage
router.get('/contracts/:id/warranty-cases',    c.getCases)
router.post('/contracts/:id/warranty-cases',   contractPermFromParam(CASE, 'id'), c.createCase)
router.put('/warranty-cases/:id',              contractPermVia(CASE, 'warrantyCase'), c.updateCase)
router.delete('/warranty-cases/:id',           contractPermVia(CASE, 'warrantyCase'), c.deleteCase)

// Case ↔ Equipment links
router.get('/warranty-cases/:id/equipment',    c.getCaseEquipment)
router.post('/warranty-cases/:id/equipment',   contractPermVia(CASE, 'warrantyCase'), c.linkEquipment)
router.delete('/warranty-case-equipment/:id',  contractPermVia(CASE, 'caseEquipment'), c.unlinkEquipment)

// Activities — ghi cần co.warranty.activities.manage
router.get('/warranty-cases/:id/activities',   c.getActivities)
router.post('/warranty-cases/:id/activities',  contractPermVia(ACT, 'warrantyCase'), c.createActivity)
router.delete('/warranty-activities/:id',      contractPermVia(ACT, 'warrantyActivity'), c.deleteActivity)
router.get('/contracts/:id/warranty-activities', c.getAllActivities)

export default router
