-- Migration for document management system
-- Creates document_folder and document_file tables linked to contract_out

-- Document folders table
CREATE TABLE IF NOT EXISTS public.document_folder (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL REFERENCES public.contract_out(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES public.document_folder(id) ON DELETE CASCADE,
    folder_name VARCHAR(255) NOT NULL,
    created_by BIGINT REFERENCES public.app_user(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Document files table
CREATE TABLE IF NOT EXISTS public.document_file (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL REFERENCES public.contract_out(id) ON DELETE CASCADE,
    folder_id BIGINT NOT NULL REFERENCES public.document_folder(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by BIGINT REFERENCES public.app_user(id),
    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_folder_contract ON public.document_folder(contract_id);
CREATE INDEX IF NOT EXISTS idx_document_folder_parent ON public.document_folder(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_file_contract ON public.document_file(contract_id);
CREATE INDEX IF NOT EXISTS idx_document_file_folder ON public.document_file(folder_id);

-- Function to create default folders for a contract
CREATE OR REPLACE FUNCTION public.create_default_contract_folders(p_contract_id BIGINT, p_created_by BIGINT)
RETURNS VOID AS $$
DECLARE
    v_root_folder_id BIGINT;
    v_folder_id BIGINT;
BEGIN
    -- Hồ sơ thầu
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Hồ sơ thầu', p_created_by)
    RETURNING id INTO v_root_folder_id;
    
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES 
        (p_contract_id, v_root_folder_id, 'HSMT', p_created_by),
        (p_contract_id, v_root_folder_id, 'HSDT', p_created_by),
        (p_contract_id, v_root_folder_id, 'Làm rõ HSDT', p_created_by);
    
    -- Hợp đồng bán
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Hợp đồng bán', p_created_by)
    RETURNING id INTO v_root_folder_id;
    
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES 
        (p_contract_id, v_root_folder_id, 'Hợp đồng chính', p_created_by),
        (p_contract_id, v_root_folder_id, 'Phụ lục', p_created_by),
        (p_contract_id, v_root_folder_id, 'Bảo lãnh', p_created_by);
    
    -- Hợp đồng nhập
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Hợp đồng nhập', p_created_by)
    RETURNING id INTO v_root_folder_id;
    
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES 
        (p_contract_id, v_root_folder_id, 'PO', p_created_by),
        (p_contract_id, v_root_folder_id, 'Hợp đồng NCC', p_created_by);
    
    -- Triển khai
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Triển khai', p_created_by)
    RETURNING id INTO v_root_folder_id;
    
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES 
        (p_contract_id, v_root_folder_id, 'Shop Drawing', p_created_by),
        (p_contract_id, v_root_folder_id, 'FAT', p_created_by),
        (p_contract_id, v_root_folder_id, 'SAT', p_created_by);
    
    -- Nghiệm thu
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Nghiệm thu', p_created_by)
    RETURNING id INTO v_root_folder_id;
    
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES 
        (p_contract_id, v_root_folder_id, 'Biên bản', p_created_by),
        (p_contract_id, v_root_folder_id, 'Thanh lý', p_created_by);
    
    -- Khác
    INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
    VALUES (p_contract_id, NULL, 'Khác', p_created_by);
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default folders when a contract is created
CREATE OR REPLACE FUNCTION public.trigger_create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_default_contract_folders(NEW.id, COALESCE(NEW.created_by, 1));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_create_default_folders ON public.contract_out;

-- Create trigger
CREATE TRIGGER trg_create_default_folders
AFTER INSERT ON public.contract_out
FOR EACH ROW
EXECUTE FUNCTION public.trigger_create_default_folders();
