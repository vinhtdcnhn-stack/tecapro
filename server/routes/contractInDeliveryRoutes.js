import { Router } from 'express'
import {
  excelUploadDelivery,
  getDeliveries, createDelivery, updateDelivery, deleteDelivery,
  getDeliveryItems, createDeliveryItem, updateDeliveryItem, deleteDeliveryItem,
  getDeliverySerials, createDeliverySerial, deleteDeliverySerial, importDeliverySerials,
  getAllDeliverySerials, getAllDeliveryItems, updateDeliverySerial, bulkDeleteDeliverySerials, replaceDeliverySerial,
} from '../controllers/contractInDeliveryController.js'
import { pmVia, pmViaBody } from '../middleware/contractAccess.js'

const router = Router()

// Delivery batches — ghi yêu cầu PM của HĐ bán cha
router.get('/contract-ins/:contractInId/deliveries',    getDeliveries)
router.post('/contract-ins/:contractInId/deliveries',   pmVia('contractIn', 'contractInId'), createDelivery)
router.put('/deliveries/:id',                           pmVia('delivery'), updateDelivery)
router.delete('/deliveries/:id',                        pmVia('delivery'), deleteDelivery)

// Items in a delivery
router.get('/deliveries/:deliveryId/items',             getDeliveryItems)
router.post('/deliveries/:deliveryId/items',            pmVia('delivery', 'deliveryId'), createDeliveryItem)
router.put('/delivery-items/:id',                       pmVia('deliveryItem'), updateDeliveryItem)
router.delete('/delivery-items/:id',                    pmVia('deliveryItem'), deleteDeliveryItem)

// Serials per item (guard trước multer với route import)
router.get('/delivery-items/:itemId/serials',           getDeliverySerials)
router.post('/delivery-items/:itemId/serials',          pmVia('deliveryItem', 'itemId'), createDeliverySerial)
router.post('/delivery-items/:itemId/serials/import',   pmVia('deliveryItem', 'itemId'), excelUploadDelivery.single('file'), importDeliverySerials)
router.delete('/delivery-serials/:id',                  pmVia('deliverySerial'), deleteDeliverySerial)

// Consolidated serial registry (whole contract)
router.get('/contract-ins/:contractInId/all-serials',   getAllDeliverySerials)
router.get('/contract-ins/:contractInId/all-items',     getAllDeliveryItems)
router.post('/delivery-serials/bulk-delete',            pmViaBody('deliverySerial'), bulkDeleteDeliverySerials)
router.put('/delivery-serials/:id',                     pmVia('deliverySerial'), updateDeliverySerial)
router.post('/delivery-serials/:id/replace',            pmVia('deliverySerial'), replaceDeliverySerial)

export default router
