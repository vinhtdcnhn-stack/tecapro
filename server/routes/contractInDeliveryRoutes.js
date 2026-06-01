import { Router } from 'express'
import {
  excelUploadDelivery,
  getDeliveries, createDelivery, updateDelivery, deleteDelivery,
  getDeliveryItems, createDeliveryItem, updateDeliveryItem, deleteDeliveryItem,
  getDeliverySerials, createDeliverySerial, deleteDeliverySerial, importDeliverySerials,
} from '../controllers/contractInDeliveryController.js'

const router = Router()

// Delivery batches
router.get('/contract-ins/:contractInId/deliveries',    getDeliveries)
router.post('/contract-ins/:contractInId/deliveries',   createDelivery)
router.put('/deliveries/:id',                           updateDelivery)
router.delete('/deliveries/:id',                        deleteDelivery)

// Items in a delivery
router.get('/deliveries/:deliveryId/items',             getDeliveryItems)
router.post('/deliveries/:deliveryId/items',            createDeliveryItem)
router.put('/delivery-items/:id',                       updateDeliveryItem)
router.delete('/delivery-items/:id',                    deleteDeliveryItem)

// Serials per item
router.get('/delivery-items/:itemId/serials',           getDeliverySerials)
router.post('/delivery-items/:itemId/serials',          createDeliverySerial)
router.post('/delivery-items/:itemId/serials/import',   excelUploadDelivery.single('file'), importDeliverySerials)
router.delete('/delivery-serials/:id',                  deleteDeliverySerial)

export default router
