import { Router } from 'express'
import * as c from '../controllers/warrantyController.js'
import * as imp from '../controllers/warrantyImportController.js'
import * as lookup from '../controllers/warrantyLookupController.js'
import { pmFromParam, pmVia, pmViaBody } from '../middleware/contractAccess.js'

const router = Router()

// Tra cứu bảo hành theo serial — cross-contract có chủ đích, chỉ đọc
router.get('/warranty-lookup', lookup.lookupSerial)

// Equipment — ghi yêu cầu PM của HĐ
router.get('/contracts/:id/equipment',        c.getEquipment)
router.post('/contracts/:id/equipment',       pmFromParam('id'), c.createEquipment)
router.post('/contracts/:id/equipment/import', pmFromParam('id'), imp.importEquipment)
router.put('/equipment/bulk-warranty',        pmViaBody('equipment'), c.bulkWarrantyEquipment)
router.put('/equipment/:id',                  pmVia('equipment'), c.updateEquipment)
router.delete('/equipment/:id',               pmVia('equipment'), c.deleteEquipment)

// Serials
router.get('/equipment/:id/serials',   c.getSerials)
router.post('/equipment/:id/serials',  pmVia('equipment'), c.createSerial)
router.post('/contracts/:id/serials/import', pmFromParam('id'), imp.importComponentSerials)
router.put('/serials/bulk-warranty',   pmViaBody('serial'), c.bulkWarrantySerials)
router.post('/serials/bulk-delete',    pmViaBody('serial'), c.bulkDeleteSerials)
router.post('/serials/:id/replace',    pmVia('serial'), lookup.replaceSerial)
router.post('/delivery-serials/:id/replace', pmVia('deliverySerial'), lookup.replaceDeliverySerial)
router.put('/serials/:id',             pmVia('serial'), c.updateSerial)
router.delete('/serials/:id',          pmVia('serial'), c.deleteSerial)

// Warranty Cases
router.get('/contracts/:id/warranty-cases',    c.getCases)
router.post('/contracts/:id/warranty-cases',   pmFromParam('id'), c.createCase)
router.put('/warranty-cases/:id',              pmVia('warrantyCase'), c.updateCase)
router.delete('/warranty-cases/:id',           pmVia('warrantyCase'), c.deleteCase)

// Case ↔ Equipment links
router.get('/warranty-cases/:id/equipment',    c.getCaseEquipment)
router.post('/warranty-cases/:id/equipment',   pmVia('warrantyCase'), c.linkEquipment)
router.delete('/warranty-case-equipment/:id',  pmVia('caseEquipment'), c.unlinkEquipment)

// Activities
router.get('/warranty-cases/:id/activities',   c.getActivities)
router.post('/warranty-cases/:id/activities',  pmVia('warrantyCase'), c.createActivity)
router.delete('/warranty-activities/:id',      pmVia('warrantyActivity'), c.deleteActivity)
router.get('/contracts/:id/warranty-activities', c.getAllActivities)

export default router
