import { Router } from 'express'
import {
  excelUploadDelivery,
  getDeliveries, createDelivery, updateDelivery, deleteDelivery,
  getDeliveryItems, createDeliveryItem, updateDeliveryItem, deleteDeliveryItem,
  getDeliverySerials, createDeliverySerial, deleteDeliverySerial, importDeliverySerials, saveScanBatch, saveScanStandalone, getDeliveryItemExport, getSerialComponents,
  getAllDeliverySerials, getAllDeliveryItems, updateDeliverySerial, bulkDeleteDeliverySerials, replaceDeliverySerial,
} from '../controllers/contractInDeliveryController.js'
import { ownerOfContractIn, ownerVia, ownerOrTechVia, ownerOrTechViaBody } from '../middleware/contractAccess.js'

const router = Router()

// Delivery batches — ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/deliveries',    getDeliveries)
router.post('/contract-ins/:contractInId/deliveries',   ownerOfContractIn('contractInId'), createDelivery)
router.put('/deliveries/:id',                           ownerVia('delivery'), updateDelivery)
router.delete('/deliveries/:id',                        ownerVia('delivery'), deleteDelivery)

// Items in a delivery
router.get('/deliveries/:deliveryId/items',             getDeliveryItems)
router.post('/deliveries/:deliveryId/items',            ownerVia('delivery', 'deliveryId'), createDeliveryItem)
router.put('/delivery-items/:id',                       ownerVia('deliveryItem'), updateDeliveryItem)
router.delete('/delivery-items/:id',                    ownerVia('deliveryItem'), deleteDeliveryItem)

// Lưu 1 máy + thành phần theo lô (1 transaction, từ chối cả máy nếu trùng) — người tạo/Kỹ thuật
router.post('/deliveries/:deliveryId/scan-batch',       ownerOrTechVia('delivery', 'deliveryId'), saveScanBatch)
// Lưu 1 thiết bị lẻ (máy độc lập) khi bắn barcode ở màn quản lý serial — người tạo/Kỹ thuật
router.post('/deliveries/:deliveryId/scan-standalone',  ownerOrTechVia('delivery', 'deliveryId'), saveScanStandalone)

// Serials per item (guard trước multer với route import) — thao tác serial: người tạo/Kỹ thuật
router.get('/delivery-items/:itemId/serials',           getDeliverySerials)
router.get('/delivery-items/:itemId/export-serials',    getDeliveryItemExport)
router.get('/delivery-serials/:id/components',          getSerialComponents)
router.post('/delivery-items/:itemId/serials',          ownerOrTechVia('deliveryItem', 'itemId'), createDeliverySerial)
router.post('/delivery-items/:itemId/serials/import',   ownerOrTechVia('deliveryItem', 'itemId'), excelUploadDelivery.single('file'), importDeliverySerials)
router.delete('/delivery-serials/:id',                  ownerOrTechVia('deliverySerial'), deleteDeliverySerial)

// Consolidated serial registry (whole contract) — thao tác serial: người tạo/Kỹ thuật
router.get('/contract-ins/:contractInId/all-serials',   getAllDeliverySerials)
router.get('/contract-ins/:contractInId/all-items',     getAllDeliveryItems)
router.post('/delivery-serials/bulk-delete',            ownerOrTechViaBody('deliverySerial'), bulkDeleteDeliverySerials)
router.put('/delivery-serials/:id',                     ownerOrTechVia('deliverySerial'), updateDeliverySerial)
router.post('/delivery-serials/:id/replace',            ownerOrTechVia('deliverySerial'), replaceDeliverySerial)

export default router
