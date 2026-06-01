import { Router } from 'express'
import {
  getSupplierWarranties, createSupplierWarranty, updateSupplierWarranty, deleteSupplierWarranty,
  initWarrantiesFromDelivery, bulkUpdateWarrantyStart,
  getWarrantyClaims, createWarrantyClaim, updateWarrantyClaim, deleteWarrantyClaim,
} from '../controllers/supplierWarrantyController.js'

const router = Router()

router.get('/contract-ins/:contractInId/supplier-warranty',               getSupplierWarranties)
router.post('/contract-ins/:contractInId/supplier-warranty',              createSupplierWarranty)
router.post('/contract-ins/:contractInId/supplier-warranty/init',         initWarrantiesFromDelivery)
router.post('/contract-ins/:contractInId/supplier-warranty/bulk-update',  bulkUpdateWarrantyStart)
router.put('/supplier-warranty/:id',                                      updateSupplierWarranty)
router.delete('/supplier-warranty/:id',                                   deleteSupplierWarranty)

router.get('/contract-ins/:contractInId/warranty-claims',                 getWarrantyClaims)
router.post('/contract-ins/:contractInId/warranty-claims',                createWarrantyClaim)
router.put('/warranty-claims/:id',                                        updateWarrantyClaim)
router.delete('/warranty-claims/:id',                                     deleteWarrantyClaim)

export default router
