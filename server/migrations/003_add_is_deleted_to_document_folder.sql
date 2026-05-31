-- Migration 003: Add is_deleted column to document_folder for soft delete
-- Add is_deleted column to document_folder table
ALTER TABLE public.document_folder
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for is_deleted for performance
CREATE INDEX IF NOT EXISTS idx_document_folder_is_deleted ON public.document_folder(is_deleted);

-- Update existing rows to have is_deleted = false
UPDATE public.document_folder SET is_deleted = FALSE WHERE is_deleted IS NULL;
