import { Router } from 'express'
import {
  excelUploadDelivery,
  getDeliveries, createDelivery, updateDelivery, deleteDelivery,
  getDeliveryItems, createDeliveryItem, updateDeliveryItem, deleteDeliveryItem,
  getDeliverySerials, createDeliverySerial, deleteDeliverySerial, importDeliverySerials, saveScanBatch, getDeliveryItemExport,
  getAllDeliverySerials, getAllDeliveryItems, updateDeliverySerial, bulkDeleteDeliverySerials, replaceDeliverySerial,
} from '../controllers/contractInDeliveryController.js'
import { pmVia, pmViaBody, pmOrTechVia, pmOrTechViaBody } from '../middleware/contractAccess.js'

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

// Lưu 1 máy + thành phần theo lô (1 transaction, từ chối cả máy nếu trùng) — PM/Kỹ thuật
router.post('/deliveries/:deliveryId/scan-batch',       pmOrTechVia('delivery', 'deliveryId'), saveScanBatch)

// Serials per item (guard trước multer với route import) — thao tác serial: PM/Kỹ thuật
router.get('/delivery-items/:itemId/serials',           getDeliverySerials)
router.get('/delivery-items/:itemId/export-serials',    getDeliveryItemExport)
router.post('/delivery-items/:itemId/serials',          pmOrTechVia('deliveryItem', 'itemId'), createDeliverySerial)
router.post('/delivery-items/:itemId/serials/import',   pmOrTechVia('deliveryItem', 'itemId'), excelUploadDelivery.single('file'), importDeliverySerials)
router.delete('/delivery-serials/:id',                  pmOrTechVia('deliverySerial'), deleteDeliverySerial)

// Consolidated serial registry (whole contract) — thao tác serial: PM/Kỹ thuật
router.get('/contract-ins/:contractInId/all-serials',   getAllDeliverySerials)
router.get('/contract-ins/:contractInId/all-items',     getAllDeliveryItems)
router.post('/delivery-serials/bulk-delete',            pmOrTechViaBody('deliverySerial'), bulkDeleteDeliverySerials)
router.put('/delivery-serials/:id',                     pmOrTechVia('deliverySerial'), updateDeliverySerial)
router.post('/delivery-serials/:id/replace',            pmOrTechVia('deliverySerial'), replaceDeliverySerial)

export default router
