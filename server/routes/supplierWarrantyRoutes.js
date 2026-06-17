import { Router } from 'express'
import {
  getSupplierWarranties, createSupplierWarranty, updateSupplierWarranty, deleteSupplierWarranty,
  initWarrantiesFromDelivery, bulkUpdateWarrantyStart,
  getWarrantyClaims, createWarrantyClaim, updateWarrantyClaim, deleteWarrantyClaim,
} from '../controllers/supplierWarrantyController.js'
import { ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'

const router = Router()

const ownerOfCI = ownerOfContractIn('contractInId')

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/supplier-warranty',               getSupplierWarranties)
router.post('/contract-ins/:contractInId/supplier-warranty',              ownerOfCI, createSupplierWarranty)
router.post('/contract-ins/:contractInId/supplier-warranty/init',         ownerOfCI, initWarrantiesFromDelivery)
router.post('/contract-ins/:contractInId/supplier-warranty/bulk-update',  ownerOfCI, bulkUpdateWarrantyStart)
router.put('/supplier-warranty/:id',                                      ownerVia('supplierWarranty'), updateSupplierWarranty)
router.delete('/supplier-warranty/:id',                                   ownerVia('supplierWarranty'), deleteSupplierWarranty)

router.get('/contract-ins/:contractInId/warranty-claims',                 getWarrantyClaims)
router.post('/contract-ins/:contractInId/warranty-claims',                ownerOfCI, createWarrantyClaim)
router.put('/warranty-claims/:id',                                        ownerVia('warrantyClaim'), updateWarrantyClaim)
router.delete('/warranty-claims/:id',                                     ownerVia('warrantyClaim'), deleteWarrantyClaim)

export default router
