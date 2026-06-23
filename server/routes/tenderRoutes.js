import { Router } from 'express'
import {
  isTenderMember, isHead, isBidMakerOrHead, isChecklistEditor, isChecklistContributor,
} from '../middleware/tenderAccess.js'
import {
  getTenders, getTender, createTender, updateTender, assignTender,
  updateTenderStatus, deleteTender, getActivityLog, getMembers, getMyTenders,
} from '../controllers/tenderController.js'
import {
  getChecklist, createItem, updateItem, updateItemStatus, deleteItem, getMyTask,
} from '../controllers/tenderChecklistController.js'
import {
  getTemplate, createTemplateItem, updateTemplateItem, deleteTemplateItem, applyTemplate,
} from '../controllers/tenderChecklistTemplateController.js'
import {
  uploadSummary, uploadVersion,
  viewAttachment, downloadAttachment,
  getSummaryFiles, uploadSummaryFile, deleteSummaryFile, viewSummary, downloadSummary,
  viewVersion, downloadVersion,
} from '../controllers/tenderFileController.js'
import {
  uploadTender, getFolderTreeTender, createFolderTender, getTenderFiles, uploadFileTender,
} from '../controllers/tenderDocController.js'
import {
  uploadTenderItem, getItemFolders, createItemFolder, getItemFiles, uploadItemDoc,
  getItemInvitationFolders, getItemInvitationFiles,
} from '../controllers/tenderItemDocController.js'
import {
  getReviewData, submitVersion, decideReview,
} from '../controllers/tenderReviewController.js'
import { getReports } from '../controllers/tenderReportController.js'

// Tất cả route đã nằm sau requireAuth (mount trong routes/index.js).
// Tiền tố /tender. Đọc cần là thành viên phòng; phân công/xoá cần Trưởng phòng.
const router = Router()

router.get('/tender/members', isTenderMember, getMembers)
router.get('/tender/my', isTenderMember, getMyTenders)
router.get('/tender/reports', isTenderMember, getReports)

// Mẫu checklist dùng chung (đặt TRƯỚC '/tender/:id'). Đọc cho mọi thành viên;
// sửa mẫu chỉ Trưởng phòng.
router.get('/tender/checklist-template', isTenderMember, getTemplate)
router.post('/tender/checklist-template', isHead, createTemplateItem)
router.put('/tender/checklist-template/:itemId', isHead, updateTemplateItem)
router.delete('/tender/checklist-template/:itemId', isHead, deleteTemplateItem)

router.get('/tender', isTenderMember, getTenders)
router.post('/tender', isTenderMember, createTender)
router.get('/tender/:id', isTenderMember, getTender)
router.put('/tender/:id', isBidMakerOrHead('id'), updateTender)
router.delete('/tender/:id', isHead, deleteTender)

// Phân công (Trưởng phòng) + đổi trạng thái/kết quả (người làm thầu hoặc trưởng phòng).
router.put('/tender/:id/assign', isHead, assignTender)
router.put('/tender/:id/status', isBidMakerOrHead('id'), updateTenderStatus)

// Nhật ký thao tác (audit).
router.get('/tender/:id/activity', isTenderMember, getActivityLog)

// ── Checklist công việc ─────────────────────────────────────────────────────
router.get('/tender/:id/checklist', isTenderMember, getChecklist)
router.post('/tender/:id/checklist/apply-template', isBidMakerOrHead('id'), applyTemplate)
router.post('/tender/:id/checklist', isBidMakerOrHead('id'), createItem)
router.put('/tender/checklist/:itemId', isChecklistEditor('itemId'), updateItem)
router.put('/tender/checklist/:itemId/status', isChecklistContributor('itemId'), updateItemStatus)
router.delete('/tender/checklist/:itemId', isChecklistEditor('itemId'), deleteItem)

// ── "Việc đấu thầu của tôi" — cho người được giao (không thuộc Ban Đấu thầu) ──
// Xem chi tiết việc + tệp sản phẩm + danh sách hồ sơ mời thầu, đổi trạng thái, nộp/
// xoá tệp sản phẩm — tất cả gác theo người được giao của ĐÚNG đầu việc/tệp đó, không
// cần mở cả module Đấu thầu. Đổi trạng thái dùng /tender/checklist/:itemId/status.
router.get('/tender/my-task/:itemId', isChecklistContributor('itemId'), getMyTask)

// Tệp sản phẩm của đầu việc = hệ thư mục/tệp khoá theo item_id (folder + file, xem
// trước, upload cả thư mục). Sửa tên/xoá thư mục, xoá/xem/tải tệp dùng route toàn
// cục /folders/:id, /files/:id (docGuard đã nới cho tệp theo item). Guard TRƯỚC multer.
router.get('/tender/my-task/:itemId/docs/folders', isChecklistContributor('itemId'), getItemFolders)
router.post('/tender/my-task/:itemId/docs/folders', isChecklistContributor('itemId'), createItemFolder)
router.get('/tender/my-task/:itemId/docs/files', isChecklistContributor('itemId'), getItemFiles)
router.post('/tender/my-task/:itemId/docs/files/upload', isChecklistContributor('itemId'), uploadTenderItem.single('file'), uploadItemDoc)

// Hồ sơ mời thầu (đầu vào) — CHỈ ĐỌC cho người được giao việc (xem/tải qua /files/:id).
router.get('/tender/my-task/:itemId/invitation/folders', isChecklistContributor('itemId'), getItemInvitationFolders)
router.get('/tender/my-task/:itemId/invitation/files', isChecklistContributor('itemId'), getItemInvitationFiles)

// Tệp sản phẩm phía Ban Đấu thầu (trong tab Checklist) — cùng kho document_file(item_id).
router.get('/tender/checklist/:itemId/docs/folders', isTenderMember, getItemFolders)
router.post('/tender/checklist/:itemId/docs/folders', isChecklistContributor('itemId'), createItemFolder)
router.get('/tender/checklist/:itemId/docs/files', isTenderMember, getItemFiles)
router.post('/tender/checklist/:itemId/docs/files/upload', isChecklistContributor('itemId'), uploadTenderItem.single('file'), uploadItemDoc)

// ── Hồ sơ mời thầu (đầu vào từ chủ đầu tư) — thư mục/tệp như tài liệu HĐ bán,
//    cho phép tải tệp vào thư mục gốc. Sửa tên/xoá thư mục, xoá/xem/tải tệp dùng
//    chung route toàn cục /folders/:id, /files/:id (documentRoutes; docGuard đã nới).
router.get('/tenders/:tenderId/folders', isTenderMember, getFolderTreeTender)
router.post('/tenders/:tenderId/folders', isBidMakerOrHead('tenderId'), createFolderTender)
router.get('/tenders/:tenderId/files', isTenderMember, getTenderFiles)
router.post('/tenders/:tenderId/files/upload', isBidMakerOrHead('tenderId'), uploadTender.single('file'), uploadFileTender)

// ── Tổng hợp hồ sơ ──────────────────────────────────────────────────────────
router.get('/tender/:id/summary', isTenderMember, getSummaryFiles)
router.post('/tender/:id/summary', isBidMakerOrHead('id'), uploadSummary.single('file'), uploadSummaryFile)
router.delete('/tender/summary/:id', isTenderMember, deleteSummaryFile)

// ── Review & Versioning ─────────────────────────────────────────────────────
router.get('/tender/:id/review', isTenderMember, getReviewData)
router.post('/tender/:id/review/submit', isBidMakerOrHead('id'), uploadVersion.single('file'), submitVersion)
router.post('/tender/review/:versionId/decide', isHead, decideReview)

// ── Phục vụ tệp (xem inline / tải về) ───────────────────────────────────────
router.get('/tender-files/attachment/:id/view', isTenderMember, viewAttachment)
router.get('/tender-files/attachment/:id/download', isTenderMember, downloadAttachment)
router.get('/tender-files/summary/:id/view', isTenderMember, viewSummary)
router.get('/tender-files/summary/:id/download', isTenderMember, downloadSummary)
router.get('/tender-files/version/:id/view', isTenderMember, viewVersion)
router.get('/tender-files/version/:id/download', isTenderMember, downloadVersion)

export default router
