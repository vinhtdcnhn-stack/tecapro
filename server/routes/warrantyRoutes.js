import { Router } from 'express'
import * as c from '../controllers/warrantyController.js'
import * as imp from '../controllers/warrantyImportController.js'
import * as lookup from '../controllers/warrantyLookupController.js'

const router = Router()

// Tra cứu bảo hành theo serial
router.get('/warranty-lookup', lookup.lookupSerial)

// Equipment
router.get('/contracts/:id/equipment',        c.getEquipment)
router.post('/contracts/:id/equipment',       c.createEquipment)
router.post('/contracts/:id/equipment/import', imp.importEquipment)
router.put('/equipment/bulk-warranty',        c.bulkWarrantyEquipment)
router.put('/equipment/:id',                  c.updateEquipment)
router.delete('/equipment/:id',               c.deleteEquipment)

// Serials
router.get('/equipment/:id/serials',   c.getSerials)
router.post('/equipment/:id/serials',  c.createSerial)
router.post('/contracts/:id/serials/import', imp.importComponentSerials)
router.put('/serials/bulk-warranty',   c.bulkWarrantySerials)
router.post('/serials/bulk-delete',    c.bulkDeleteSerials)
router.post('/serials/:id/replace',    lookup.replaceSerial)
router.post('/delivery-serials/:id/replace', lookup.replaceDeliverySerial)
router.put('/serials/:id',             c.updateSerial)
router.delete('/serials/:id',          c.deleteSerial)

// Warranty Cases
router.get('/contracts/:id/warranty-cases',    c.getCases)
router.post('/contracts/:id/warranty-cases',   c.createCase)
router.put('/warranty-cases/:id',              c.updateCase)
router.delete('/warranty-cases/:id',           c.deleteCase)

// Case ↔ Equipment links
router.get('/warranty-cases/:id/equipment',    c.getCaseEquipment)
router.post('/warranty-cases/:id/equipment',   c.linkEquipment)
router.delete('/warranty-case-equipment/:id',  c.unlinkEquipment)

// Activities
router.get('/warranty-cases/:id/activities',   c.getActivities)
router.post('/warranty-cases/:id/activities',  c.createActivity)
router.delete('/warranty-activities/:id',      c.deleteActivity)
router.get('/contracts/:id/warranty-activities', c.getAllActivities)

export default router
