-- Migration 002: Add is_deleted column to document_file for soft delete
-- Add is_deleted column to document_file table
ALTER TABLE public.document_file 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for is_deleted for performance
CREATE INDEX IF NOT EXISTS idx_document_file_is_deleted ON public.document_file(is_deleted);

-- Update existing rows to have is_deleted = false
UPDATE public.document_file SET is_deleted = FALSE WHERE is_deleted IS NULL;
