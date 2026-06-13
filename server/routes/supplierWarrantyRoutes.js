import { Router } from 'express'
import {
  getSupplierWarranties, createSupplierWarranty, updateSupplierWarranty, deleteSupplierWarranty,
  initWarrantiesFromDelivery, bulkUpdateWarrantyStart,
  getWarrantyClaims, createWarrantyClaim, updateWarrantyClaim, deleteWarrantyClaim,
} from '../controllers/supplierWarrantyController.js'
import { pmVia } from '../middleware/contractAccess.js'

const router = Router()

const pmOfContractIn = pmVia('contractIn', 'contractInId')

// Ghi yêu cầu PM của HĐ bán cha
router.get('/contract-ins/:contractInId/supplier-warranty',               getSupplierWarranties)
router.post('/contract-ins/:contractInId/supplier-warranty',              pmOfContractIn, createSupplierWarranty)
router.post('/contract-ins/:contractInId/supplier-warranty/init',         pmOfContractIn, initWarrantiesFromDelivery)
router.post('/contract-ins/:contractInId/supplier-warranty/bulk-update',  pmOfContractIn, bulkUpdateWarrantyStart)
router.put('/supplier-warranty/:id',                                      pmVia('supplierWarranty'), updateSupplierWarranty)
router.delete('/supplier-warranty/:id',                                   pmVia('supplierWarranty'), deleteSupplierWarranty)

router.get('/contract-ins/:contractInId/warranty-claims',                 getWarrantyClaims)
router.post('/contract-ins/:contractInId/warranty-claims',                pmOfContractIn, createWarrantyClaim)
router.put('/warranty-claims/:id',                                        pmVia('warrantyClaim'), updateWarrantyClaim)
router.delete('/warranty-claims/:id',                                     pmVia('warrantyClaim'), deleteWarrantyClaim)

export default router
