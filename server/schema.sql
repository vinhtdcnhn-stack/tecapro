-- =============================================================================
-- schema.sql — Toàn bộ schema CSDL (đã hợp nhất từ 41 file migration cũ)
--
-- File này là NGUỒN CHUẨN DUY NHẤT cho cấu trúc database.
-- Sinh bằng: pg_dump --schema-only --no-owner --no-privileges (trạng thái thật
-- của DB local hello_web_db, ngày 2026-06-12).
--
-- Khởi tạo DB mới (1 lệnh duy nhất):
--   psql -d <db> -f server/schema.sql
--
-- Khi cần đổi cấu trúc về sau: sửa trực tiếp DB rồi dump lại đè lên file này
--   pg_dump --schema-only --no-owner --no-privileges -d <db> | (giữ header này)
-- =============================================================================

--
-- PostgreSQL database dump
--

\restrict nRedHhpfeTVIEn8cJ7R3go6cw1VbT3LD7osoHzDfVoag6xC9PizDcpIxRPNscco

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    employee_code character varying(50),
    username character varying(50),
    full_name character varying(255),
    phone character varying(30),
    department_id integer,
    position_id integer,
    manager_id integer,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    telegram_chat_id text,
    token_version integer DEFAULT 0 NOT NULL
);


--
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
-- Name: app_user_position; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user_position (
    user_id bigint NOT NULL,
    position_id integer NOT NULL
);


--
-- Name: contract_bb_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_bb_type (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contract_bb_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_bb_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_bb_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_bb_type_id_seq OWNED BY public.contract_bb_type.id;


--
-- Name: contract_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_equipment (
    id integer NOT NULL,
    contract_out_id integer NOT NULL,
    name character varying(500) NOT NULL,
    brand character varying(200),
    model character varying(200),
    quantity numeric(10,2) DEFAULT 1,
    location character varying(500),
    warranty_from date,
    warranty_to date,
    has_serial boolean DEFAULT false,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_equipment_id_seq OWNED BY public.contract_equipment.id;


--
-- Name: contract_guarantee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_guarantee (
    id integer NOT NULL,
    contract_out_id integer NOT NULL,
    guarantee_type character varying(200),
    amount numeric(20,2) DEFAULT 0,
    issue_date date,
    expiry_date date,
    status character varying(50) DEFAULT 'Còn hiệu lực'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_guarantee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_guarantee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_guarantee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_guarantee_id_seq OWNED BY public.contract_guarantee.id;


--
-- Name: contract_in; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    contract_no character varying(100),
    goods_type character varying(500),
    contract_date date,
    supplier_id bigint,
    amount numeric(20,2) DEFAULT 0,
    currency_code character varying(10) DEFAULT 'VND'::character varying,
    exchange_rate numeric(18,4),
    purchase_type character varying(50) DEFAULT 'Trong nước'::character varying,
    status character varying(50) DEFAULT 'Active'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_boq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_boq (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    sort_order integer DEFAULT 0,
    item_name character varying(1000) DEFAULT ''::character varying NOT NULL,
    unit character varying(100) DEFAULT ''::character varying,
    quantity numeric(20,4) DEFAULT 0,
    unit_price numeric(20,4) DEFAULT 0,
    amount_before_vat numeric(20,2) DEFAULT 0,
    vat_rate numeric(6,2) DEFAULT 0,
    amount_after_vat numeric(20,2) DEFAULT 0,
    warranty_period character varying(200) DEFAULT ''::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_boq_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_boq_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_boq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_boq_id_seq OWNED BY public.contract_in_boq.id;


--
-- Name: contract_in_customs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_customs (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    shipment_type character varying(20) DEFAULT 'Nhập khẩu'::character varying,
    declaration_no character varying(100),
    declaration_date date,
    bl_awb_no character varying(200),
    etd date,
    eta date,
    port_of_loading character varying(200),
    port_of_discharge character varying(200),
    customs_status character varying(100) DEFAULT 'Chưa khai báo'::character varying,
    shipping_cost numeric(20,2) DEFAULT 0,
    tax_amount numeric(20,2) DEFAULT 0,
    other_fees numeric(20,2) DEFAULT 0,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_customs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_customs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_customs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_customs_id_seq OWNED BY public.contract_in_customs.id;


--
-- Name: contract_in_delivery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_delivery (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    batch_name character varying(200),
    receive_date date,
    warehouse character varying(500),
    status character varying(50) DEFAULT 'Chờ nhận'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_delivery_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_delivery_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_delivery_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_delivery_id_seq OWNED BY public.contract_in_delivery.id;


--
-- Name: contract_in_delivery_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_delivery_item (
    id integer NOT NULL,
    delivery_id integer NOT NULL,
    boq_item_id integer,
    item_name character varying(1000) DEFAULT ''::character varying NOT NULL,
    unit character varying(100) DEFAULT ''::character varying,
    ordered_quantity numeric(20,4) DEFAULT 0,
    received_quantity numeric(20,4) DEFAULT 0,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_delivery_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_delivery_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_delivery_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_delivery_item_id_seq OWNED BY public.contract_in_delivery_item.id;


--
-- Name: contract_in_delivery_serial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_delivery_serial (
    id integer NOT NULL,
    delivery_item_id integer NOT NULL,
    serial_no character varying(200) NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'Đang hoạt động'::character varying,
    replaced_by_serial_id integer,
    replaced_at date,
    parent_serial_id integer
);


--
-- Name: contract_in_delivery_serial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_delivery_serial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_delivery_serial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_delivery_serial_id_seq OWNED BY public.contract_in_delivery_serial.id;


--
-- Name: contract_in_guarantee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_guarantee (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    guarantee_type character varying(200) DEFAULT 'Bảo lãnh thanh toán'::character varying,
    amount numeric(20,2) DEFAULT 0,
    issue_date date,
    expiry_date date,
    status character varying(50) DEFAULT 'Còn hiệu lực'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_guarantee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_guarantee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_guarantee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_guarantee_id_seq OWNED BY public.contract_in_guarantee.id;


--
-- Name: contract_in_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.contract_in ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contract_in_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: contract_in_logistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_logistics (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    carrier character varying(300),
    tracking_no character varying(200),
    has_insurance boolean DEFAULT false,
    insurance_note character varying(500),
    status character varying(100) DEFAULT 'Chờ vận chuyển'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_logistics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_logistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_logistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_logistics_id_seq OWNED BY public.contract_in_logistics.id;


--
-- Name: contract_in_logistics_update; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_logistics_update (
    id integer NOT NULL,
    logistics_id integer NOT NULL,
    update_time timestamp with time zone DEFAULT now(),
    location character varying(300),
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_logistics_update_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_logistics_update_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_logistics_update_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_logistics_update_id_seq OWNED BY public.contract_in_logistics_update.id;


--
-- Name: contract_in_payable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_payable (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    description character varying(500) DEFAULT ''::character varying,
    payment_method character varying(100) DEFAULT 'TT'::character varying,
    currency_code character varying(10) DEFAULT 'VND'::character varying,
    amount numeric(20,4) DEFAULT 0,
    exchange_rate numeric(18,4) DEFAULT 1,
    amount_vnd numeric(20,2) DEFAULT 0,
    due_date date,
    delay_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_payable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_payable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_payable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_payable_id_seq OWNED BY public.contract_in_payable.id;


--
-- Name: contract_in_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_payment (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    payment_date date,
    currency_code character varying(10) DEFAULT 'VND'::character varying,
    amount numeric(20,4) DEFAULT 0,
    exchange_rate numeric(18,4) DEFAULT 1,
    amount_vnd numeric(20,2) DEFAULT 0,
    payment_ratio numeric(6,2),
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_payment_id_seq OWNED BY public.contract_in_payment.id;


--
-- Name: contract_in_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_progress (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    bb_type_id integer,
    sort_order integer DEFAULT 0,
    planned_date date,
    actual_date date,
    reason text DEFAULT ''::text,
    penalty_note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_progress_id_seq OWNED BY public.contract_in_progress.id;


--
-- Name: contract_in_supplier_warranty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_supplier_warranty (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    delivery_item_id integer,
    item_name character varying(500) DEFAULT ''::character varying NOT NULL,
    warranty_period_text character varying(200) DEFAULT ''::character varying,
    warranty_start date,
    warranty_end date,
    has_guarantee boolean DEFAULT false,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_supplier_warranty_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_supplier_warranty_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_supplier_warranty_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_supplier_warranty_id_seq OWNED BY public.contract_in_supplier_warranty.id;


--
-- Name: contract_in_warranty_claim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_in_warranty_claim (
    id integer NOT NULL,
    contract_in_id bigint NOT NULL,
    warranty_id integer,
    claim_no character varying(100),
    title character varying(500) NOT NULL,
    description text,
    reported_date date DEFAULT CURRENT_DATE,
    status character varying(50) DEFAULT 'Tiếp nhận'::character varying,
    resolved_date date,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_in_warranty_claim_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_in_warranty_claim_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_in_warranty_claim_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_in_warranty_claim_id_seq OWNED BY public.contract_in_warranty_claim.id;


--
-- Name: contract_out; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_out (
    id bigint NOT NULL,
    contract_no character varying(100) NOT NULL,
    contract_date date,
    pakd_no character varying(100),
    uq_no character varying(100),
    customer_id bigint NOT NULL,
    tender_name character varying(500),
    project_name character varying(500),
    contract_type character varying(100),
    currency_code character varying(10) DEFAULT 'VND'::character varying NOT NULL,
    exchange_rate numeric(18,4) DEFAULT 1,
    amount_before_vat numeric(18,2) DEFAULT 0,
    amount_after_vat numeric(18,2) DEFAULT 0,
    payment_term text,
    status character varying(50) DEFAULT 'Draft'::character varying,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now(),
    updated_by bigint,
    updated_at timestamp without time zone,
    is_deleted boolean DEFAULT false,
    is_joint_venture boolean DEFAULT false NOT NULL
);


--
-- Name: contract_out_boq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_out_boq (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL,
    item_name character varying(500) DEFAULT ''::character varying NOT NULL,
    hs_code character varying(100) DEFAULT ''::character varying,
    unit character varying(100) DEFAULT ''::character varying,
    quantity numeric(18,4) DEFAULT 0 NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    amount_before_vat numeric(18,2) DEFAULT 0 NOT NULL,
    vat_rate numeric(5,2) DEFAULT 0 NOT NULL,
    amount_after_vat numeric(18,2) DEFAULT 0 NOT NULL,
    warranty_period character varying(255) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    item_type character varying(20) DEFAULT 'trong_nuoc'::character varying NOT NULL
);


--
-- Name: contract_out_boq_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_out_boq_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_out_boq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_out_boq_id_seq OWNED BY public.contract_out_boq.id;


--
-- Name: contract_out_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_out_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_out_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_out_id_seq OWNED BY public.contract_out.id;


--
-- Name: contract_out_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_out_member (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    user_id bigint NOT NULL,
    member_role character varying(50) NOT NULL,
    is_primary boolean DEFAULT false,
    role_rank integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contract_out_member_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_out_member_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_out_member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_out_member_id_seq OWNED BY public.contract_out_member.id;


--
-- Name: contract_out_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_out_progress (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    bb_type_id integer,
    sort_order integer DEFAULT 1,
    planned_date date,
    actual_date date,
    reason text DEFAULT ''::text,
    penalty_note text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    offset_days integer,
    base_bb_type_id integer,
    base_anchor character varying(20),
    hd_offset_days integer,
    hd_base_bb_type_id integer,
    hd_base_anchor character varying(20)
);


--
-- Name: contract_out_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_out_progress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_out_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_out_progress_id_seq OWNED BY public.contract_out_progress.id;


--
-- Name: contract_receivable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_receivable (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    sort_order integer DEFAULT 1,
    description character varying(500) DEFAULT ''::character varying,
    currency_code character varying(10) DEFAULT 'VND'::character varying,
    amount numeric(18,2) DEFAULT 0,
    exchange_rate numeric(18,4) DEFAULT 1,
    amount_vnd numeric(18,2) DEFAULT 0,
    due_date date,
    delay_reason text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    due_offset_days integer,
    due_base_bb_type_id bigint,
    due_base_anchor character varying(20)
);


--
-- Name: contract_receivable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_receivable_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_receivable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_receivable_id_seq OWNED BY public.contract_receivable.id;


--
-- Name: contract_receivable_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_receivable_payment (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    sort_order integer DEFAULT 1,
    payment_date date,
    currency_code character varying(10) DEFAULT 'VND'::character varying,
    amount numeric(18,2) DEFAULT 0,
    exchange_rate numeric(18,4) DEFAULT 1,
    amount_vnd numeric(18,2) DEFAULT 0,
    payment_ratio numeric(6,2) DEFAULT 0,
    note text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    schedule_id bigint
);


--
-- Name: contract_receivable_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_receivable_payment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_receivable_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_receivable_payment_id_seq OWNED BY public.contract_receivable_payment.id;


--
-- Name: contract_task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_task (
    id integer NOT NULL,
    contract_out_id integer NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    department_id integer,
    assigned_to integer,
    created_by integer,
    priority character varying(20) DEFAULT 'Bình thường'::character varying NOT NULL,
    due_date date,
    status character varying(50) DEFAULT 'Chờ xử lý'::character varying NOT NULL,
    note text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_task_attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_task_attachment (
    id integer NOT NULL,
    task_id integer NOT NULL,
    file_name character varying(500) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type character varying(200),
    uploaded_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_task_attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_task_attachment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_task_attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_task_attachment_id_seq OWNED BY public.contract_task_attachment.id;


--
-- Name: contract_task_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_task_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_task_id_seq OWNED BY public.contract_task.id;


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(500) NOT NULL,
    tax_code character varying(50),
    address text,
    contact_person character varying(255),
    phone character varying(50),
    email character varying(255),
    is_active boolean DEFAULT true,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now(),
    updated_by bigint,
    updated_at timestamp without time zone
);


--
-- Name: customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_id_seq OWNED BY public.customer.id;


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    parent_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_id_seq OWNED BY public.department.id;


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id bigint NOT NULL,
    contract_out_id bigint NOT NULL,
    file_name character varying(500) NOT NULL,
    file_path text NOT NULL,
    document_type character varying(100),
    version_no integer DEFAULT 1,
    uploaded_by bigint,
    uploaded_at timestamp without time zone DEFAULT now()
);


--
-- Name: document_file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_file (
    id integer NOT NULL,
    contract_id bigint,
    folder_id bigint NOT NULL,
    file_name character varying(500),
    file_path character varying(1000),
    file_size bigint,
    mime_type character varying(100),
    uploaded_by bigint,
    uploaded_at timestamp without time zone DEFAULT now(),
    contract_in_id bigint
);


--
-- Name: document_file_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_file_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_file_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_file_id_seq OWNED BY public.document_file.id;


--
-- Name: document_folder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folder (
    id integer NOT NULL,
    contract_id bigint,
    parent_id bigint,
    folder_name character varying(255) NOT NULL,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    contract_in_id bigint
);


--
-- Name: document_folder_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_folder_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_folder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_folder_id_seq OWNED BY public.document_folder.id;


--
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
-- Name: equipment_serial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_serial (
    id integer NOT NULL,
    equipment_id integer NOT NULL,
    serial_no character varying(200) NOT NULL,
    status character varying(50) DEFAULT 'Đang hoạt động'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    warranty_from date,
    warranty_to date,
    parent_serial_id integer,
    replaced_by_serial_id integer,
    replaced_at date
);


--
-- Name: equipment_serial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_serial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_serial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_serial_id_seq OWNED BY public.equipment_serial.id;


--
-- Name: pm_dashboard_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_dashboard_tracking (
    id integer NOT NULL,
    user_id integer NOT NULL,
    source_type character varying(20) NOT NULL,
    source_id integer NOT NULL,
    pinned boolean DEFAULT false,
    remind_at date,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pm_dashboard_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pm_dashboard_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pm_dashboard_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pm_dashboard_tracking_id_seq OWNED BY public.pm_dashboard_tracking.id;


--
-- Name: position; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."position" (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    level_no integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: position_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.position_id_seq OWNED BY public."position".id;


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(500) NOT NULL,
    tax_code character varying(50),
    address text,
    contact_person character varying(255),
    phone character varying(50),
    email character varying(255),
    note text,
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.supplier ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.supplier_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: warranty_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warranty_activity (
    id integer NOT NULL,
    case_id integer NOT NULL,
    activity_type character varying(100),
    description text NOT NULL,
    performed_by character varying(255),
    performed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: warranty_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warranty_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warranty_activity_id_seq OWNED BY public.warranty_activity.id;


--
-- Name: warranty_case; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warranty_case (
    id integer NOT NULL,
    contract_out_id integer NOT NULL,
    case_no character varying(100),
    title character varying(500) NOT NULL,
    description text,
    reported_by character varying(255),
    reported_date date DEFAULT CURRENT_DATE,
    priority character varying(20) DEFAULT 'Bình thường'::character varying,
    status character varying(50) DEFAULT 'Tiếp nhận'::character varying,
    resolved_date date,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: warranty_case_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warranty_case_equipment (
    id integer NOT NULL,
    case_id integer NOT NULL,
    equipment_id integer NOT NULL,
    serial_id integer,
    note text
);


--
-- Name: warranty_case_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_case_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warranty_case_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warranty_case_equipment_id_seq OWNED BY public.warranty_case_equipment.id;


--
-- Name: warranty_case_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_case_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warranty_case_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warranty_case_id_seq OWNED BY public.warranty_case.id;


--
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- Name: contract_bb_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_bb_type ALTER COLUMN id SET DEFAULT nextval('public.contract_bb_type_id_seq'::regclass);


--
-- Name: contract_equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_equipment ALTER COLUMN id SET DEFAULT nextval('public.contract_equipment_id_seq'::regclass);


--
-- Name: contract_guarantee id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_guarantee ALTER COLUMN id SET DEFAULT nextval('public.contract_guarantee_id_seq'::regclass);


--
-- Name: contract_in_boq id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_boq ALTER COLUMN id SET DEFAULT nextval('public.contract_in_boq_id_seq'::regclass);


--
-- Name: contract_in_customs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_customs ALTER COLUMN id SET DEFAULT nextval('public.contract_in_customs_id_seq'::regclass);


--
-- Name: contract_in_delivery id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery ALTER COLUMN id SET DEFAULT nextval('public.contract_in_delivery_id_seq'::regclass);


--
-- Name: contract_in_delivery_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_item ALTER COLUMN id SET DEFAULT nextval('public.contract_in_delivery_item_id_seq'::regclass);


--
-- Name: contract_in_delivery_serial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_serial ALTER COLUMN id SET DEFAULT nextval('public.contract_in_delivery_serial_id_seq'::regclass);


--
-- Name: contract_in_guarantee id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_guarantee ALTER COLUMN id SET DEFAULT nextval('public.contract_in_guarantee_id_seq'::regclass);


--
-- Name: contract_in_logistics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics ALTER COLUMN id SET DEFAULT nextval('public.contract_in_logistics_id_seq'::regclass);


--
-- Name: contract_in_logistics_update id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics_update ALTER COLUMN id SET DEFAULT nextval('public.contract_in_logistics_update_id_seq'::regclass);


--
-- Name: contract_in_payable id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payable ALTER COLUMN id SET DEFAULT nextval('public.contract_in_payable_id_seq'::regclass);


--
-- Name: contract_in_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payment ALTER COLUMN id SET DEFAULT nextval('public.contract_in_payment_id_seq'::regclass);


--
-- Name: contract_in_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_progress ALTER COLUMN id SET DEFAULT nextval('public.contract_in_progress_id_seq'::regclass);


--
-- Name: contract_in_supplier_warranty id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_supplier_warranty ALTER COLUMN id SET DEFAULT nextval('public.contract_in_supplier_warranty_id_seq'::regclass);


--
-- Name: contract_in_warranty_claim id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_warranty_claim ALTER COLUMN id SET DEFAULT nextval('public.contract_in_warranty_claim_id_seq'::regclass);


--
-- Name: contract_out id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out ALTER COLUMN id SET DEFAULT nextval('public.contract_out_id_seq'::regclass);


--
-- Name: contract_out_boq id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_boq ALTER COLUMN id SET DEFAULT nextval('public.contract_out_boq_id_seq'::regclass);


--
-- Name: contract_out_member id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_member ALTER COLUMN id SET DEFAULT nextval('public.contract_out_member_id_seq'::regclass);


--
-- Name: contract_out_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_progress ALTER COLUMN id SET DEFAULT nextval('public.contract_out_progress_id_seq'::regclass);


--
-- Name: contract_receivable id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_receivable ALTER COLUMN id SET DEFAULT nextval('public.contract_receivable_id_seq'::regclass);


--
-- Name: contract_receivable_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_receivable_payment ALTER COLUMN id SET DEFAULT nextval('public.contract_receivable_payment_id_seq'::regclass);


--
-- Name: contract_task id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task ALTER COLUMN id SET DEFAULT nextval('public.contract_task_id_seq'::regclass);


--
-- Name: contract_task_attachment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task_attachment ALTER COLUMN id SET DEFAULT nextval('public.contract_task_attachment_id_seq'::regclass);


--
-- Name: customer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer ALTER COLUMN id SET DEFAULT nextval('public.customer_id_seq'::regclass);


--
-- Name: department id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department ALTER COLUMN id SET DEFAULT nextval('public.department_id_seq'::regclass);


--
-- Name: document id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- Name: document_file id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file ALTER COLUMN id SET DEFAULT nextval('public.document_file_id_seq'::regclass);


--
-- Name: document_folder id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder ALTER COLUMN id SET DEFAULT nextval('public.document_folder_id_seq'::regclass);


--
-- Name: equipment_serial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_serial ALTER COLUMN id SET DEFAULT nextval('public.equipment_serial_id_seq'::regclass);


--
-- Name: pm_dashboard_tracking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_dashboard_tracking ALTER COLUMN id SET DEFAULT nextval('public.pm_dashboard_tracking_id_seq'::regclass);


--
-- Name: position id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position" ALTER COLUMN id SET DEFAULT nextval('public.position_id_seq'::regclass);


--
-- Name: warranty_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_activity ALTER COLUMN id SET DEFAULT nextval('public.warranty_activity_id_seq'::regclass);


--
-- Name: warranty_case id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case ALTER COLUMN id SET DEFAULT nextval('public.warranty_case_id_seq'::regclass);


--
-- Name: warranty_case_equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case_equipment ALTER COLUMN id SET DEFAULT nextval('public.warranty_case_equipment_id_seq'::regclass);


--
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: app_user_position app_user_position_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user_position
    ADD CONSTRAINT app_user_position_pkey PRIMARY KEY (user_id, position_id);


--
-- Name: contract_bb_type contract_bb_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_bb_type
    ADD CONSTRAINT contract_bb_type_code_key UNIQUE (code);


--
-- Name: contract_bb_type contract_bb_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_bb_type
    ADD CONSTRAINT contract_bb_type_pkey PRIMARY KEY (id);


--
-- Name: contract_equipment contract_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_equipment
    ADD CONSTRAINT contract_equipment_pkey PRIMARY KEY (id);


--
-- Name: contract_guarantee contract_guarantee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_guarantee
    ADD CONSTRAINT contract_guarantee_pkey PRIMARY KEY (id);


--
-- Name: contract_in_boq contract_in_boq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_boq
    ADD CONSTRAINT contract_in_boq_pkey PRIMARY KEY (id);


--
-- Name: contract_in_customs contract_in_customs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_customs
    ADD CONSTRAINT contract_in_customs_pkey PRIMARY KEY (id);


--
-- Name: contract_in_delivery_item contract_in_delivery_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_item
    ADD CONSTRAINT contract_in_delivery_item_pkey PRIMARY KEY (id);


--
-- Name: contract_in_delivery contract_in_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery
    ADD CONSTRAINT contract_in_delivery_pkey PRIMARY KEY (id);


--
-- Name: contract_in_delivery_serial contract_in_delivery_serial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_serial
    ADD CONSTRAINT contract_in_delivery_serial_pkey PRIMARY KEY (id);


--
-- Name: contract_in_guarantee contract_in_guarantee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_guarantee
    ADD CONSTRAINT contract_in_guarantee_pkey PRIMARY KEY (id);


--
-- Name: contract_in_logistics contract_in_logistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics
    ADD CONSTRAINT contract_in_logistics_pkey PRIMARY KEY (id);


--
-- Name: contract_in_logistics_update contract_in_logistics_update_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics_update
    ADD CONSTRAINT contract_in_logistics_update_pkey PRIMARY KEY (id);


--
-- Name: contract_in_payable contract_in_payable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payable
    ADD CONSTRAINT contract_in_payable_pkey PRIMARY KEY (id);


--
-- Name: contract_in_payment contract_in_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payment
    ADD CONSTRAINT contract_in_payment_pkey PRIMARY KEY (id);


--
-- Name: contract_in contract_in_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in
    ADD CONSTRAINT contract_in_pkey PRIMARY KEY (id);


--
-- Name: contract_in_progress contract_in_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_progress
    ADD CONSTRAINT contract_in_progress_pkey PRIMARY KEY (id);


--
-- Name: contract_in_supplier_warranty contract_in_supplier_warranty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_supplier_warranty
    ADD CONSTRAINT contract_in_supplier_warranty_pkey PRIMARY KEY (id);


--
-- Name: contract_in_warranty_claim contract_in_warranty_claim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_warranty_claim
    ADD CONSTRAINT contract_in_warranty_claim_pkey PRIMARY KEY (id);


--
-- Name: contract_out_boq contract_out_boq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_boq
    ADD CONSTRAINT contract_out_boq_pkey PRIMARY KEY (id);


--
-- Name: contract_out contract_out_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_contract_no_key UNIQUE (contract_no);


--
-- Name: contract_out_member contract_out_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_pkey PRIMARY KEY (id);


--
-- Name: contract_out contract_out_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_pkey PRIMARY KEY (id);


--
-- Name: contract_out_progress contract_out_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_progress
    ADD CONSTRAINT contract_out_progress_pkey PRIMARY KEY (id);


--
-- Name: contract_receivable_payment contract_receivable_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_receivable_payment
    ADD CONSTRAINT contract_receivable_payment_pkey PRIMARY KEY (id);


--
-- Name: contract_receivable contract_receivable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_receivable
    ADD CONSTRAINT contract_receivable_pkey PRIMARY KEY (id);


--
-- Name: contract_task_attachment contract_task_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task_attachment
    ADD CONSTRAINT contract_task_attachment_pkey PRIMARY KEY (id);


--
-- Name: contract_task contract_task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task
    ADD CONSTRAINT contract_task_pkey PRIMARY KEY (id);


--
-- Name: customer customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_code_key UNIQUE (code);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: department department_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_code_key UNIQUE (code);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: document_file document_file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file
    ADD CONSTRAINT document_file_pkey PRIMARY KEY (id);


--
-- Name: document_folder document_folder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder
    ADD CONSTRAINT document_folder_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: equipment_serial equipment_serial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_serial
    ADD CONSTRAINT equipment_serial_pkey PRIMARY KEY (id);


--
-- Name: pm_dashboard_tracking pm_dashboard_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_dashboard_tracking
    ADD CONSTRAINT pm_dashboard_tracking_pkey PRIMARY KEY (id);


--
-- Name: pm_dashboard_tracking pm_dashboard_tracking_user_id_source_type_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_dashboard_tracking
    ADD CONSTRAINT pm_dashboard_tracking_user_id_source_type_source_id_key UNIQUE (user_id, source_type, source_id);


--
-- Name: position position_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_code_key UNIQUE (code);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_code_key UNIQUE (code);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: app_user uq_app_user_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT uq_app_user_username UNIQUE (username);


--
-- Name: contract_out_member uq_contract_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT uq_contract_member UNIQUE (contract_out_id, user_id, member_role);


--
-- Name: warranty_activity warranty_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_activity
    ADD CONSTRAINT warranty_activity_pkey PRIMARY KEY (id);


--
-- Name: warranty_case_equipment warranty_case_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case_equipment
    ADD CONSTRAINT warranty_case_equipment_pkey PRIMARY KEY (id);


--
-- Name: warranty_case warranty_case_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case
    ADD CONSTRAINT warranty_case_pkey PRIMARY KEY (id);


--
-- Name: idx_app_user_position_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_user_position_user ON public.app_user_position USING btree (user_id);


--
-- Name: idx_boq_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boq_contract ON public.contract_out_boq USING btree (contract_out_id);


--
-- Name: idx_boq_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boq_sort ON public.contract_out_boq USING btree (contract_out_id, sort_order);


--
-- Name: idx_contract_equipment_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_equipment_contract ON public.contract_equipment USING btree (contract_out_id);


--
-- Name: idx_contract_in_boq_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_boq_contract ON public.contract_in_boq USING btree (contract_in_id);


--
-- Name: idx_contract_in_customs_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_customs_contract ON public.contract_in_customs USING btree (contract_in_id);


--
-- Name: idx_contract_in_guarantee_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_guarantee_contract ON public.contract_in_guarantee USING btree (contract_in_id);


--
-- Name: idx_contract_in_logistics_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_logistics_contract ON public.contract_in_logistics USING btree (contract_in_id);


--
-- Name: idx_contract_in_out; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_out ON public.contract_in USING btree (contract_out_id);


--
-- Name: idx_contract_in_progress_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_progress_contract ON public.contract_in_progress USING btree (contract_in_id);


--
-- Name: idx_contract_in_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_in_supplier ON public.contract_in USING btree (supplier_id);


--
-- Name: idx_contract_member_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_member_contract ON public.contract_out_member USING btree (contract_out_id);


--
-- Name: idx_contract_member_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_member_user ON public.contract_out_member USING btree (user_id);


--
-- Name: idx_contract_out_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_out_customer ON public.contract_out USING btree (customer_id);


--
-- Name: idx_contract_out_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_out_no ON public.contract_out USING btree (contract_no);


--
-- Name: idx_contract_out_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_out_status ON public.contract_out USING btree (status);


--
-- Name: idx_contract_task_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_task_assigned ON public.contract_task USING btree (assigned_to);


--
-- Name: idx_contract_task_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_task_contract ON public.contract_task USING btree (contract_out_id);


--
-- Name: idx_contract_task_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_task_dept ON public.contract_task USING btree (department_id);


--
-- Name: idx_contract_task_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_task_status ON public.contract_task USING btree (status);


--
-- Name: idx_delivery_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_contract ON public.contract_in_delivery USING btree (contract_in_id);


--
-- Name: idx_delivery_item_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_item_batch ON public.contract_in_delivery_item USING btree (delivery_id);


--
-- Name: idx_delivery_serial_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_serial_item ON public.contract_in_delivery_serial USING btree (delivery_item_id);


--
-- Name: idx_delivery_serial_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_serial_parent ON public.contract_in_delivery_serial USING btree (parent_serial_id);


--
-- Name: idx_delivery_serial_replaced_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_serial_replaced_by ON public.contract_in_delivery_serial USING btree (replaced_by_serial_id);


--
-- Name: idx_doc_file_contract_in; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_file_contract_in ON public.document_file USING btree (contract_in_id);


--
-- Name: idx_doc_folder_contract_in; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_folder_contract_in ON public.document_folder USING btree (contract_in_id);


--
-- Name: idx_document_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_contract ON public.document USING btree (contract_out_id);


--
-- Name: idx_document_folder_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_folder_is_deleted ON public.document_folder USING btree (is_deleted);


--
-- Name: idx_equipment_serial_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_serial_equipment ON public.equipment_serial USING btree (equipment_id);


--
-- Name: idx_equipment_serial_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_serial_parent ON public.equipment_serial USING btree (parent_serial_id);


--
-- Name: idx_equipment_serial_replaced_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_serial_replaced_by ON public.equipment_serial USING btree (replaced_by_serial_id);


--
-- Name: idx_logistics_update_logistics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_update_logistics ON public.contract_in_logistics_update USING btree (logistics_id);


--
-- Name: idx_pay_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_contract ON public.contract_receivable_payment USING btree (contract_out_id);


--
-- Name: idx_pay_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_schedule ON public.contract_receivable_payment USING btree (schedule_id);


--
-- Name: idx_pay_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_sort ON public.contract_receivable_payment USING btree (contract_out_id, sort_order);


--
-- Name: idx_payable_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payable_contract ON public.contract_in_payable USING btree (contract_in_id);


--
-- Name: idx_payment_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_contract ON public.contract_in_payment USING btree (contract_in_id);


--
-- Name: idx_pm_track_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_track_user ON public.pm_dashboard_tracking USING btree (user_id);


--
-- Name: idx_progress_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_contract ON public.contract_out_progress USING btree (contract_out_id);


--
-- Name: idx_progress_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_sort ON public.contract_out_progress USING btree (contract_out_id, sort_order);


--
-- Name: idx_recv_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recv_contract ON public.contract_receivable USING btree (contract_out_id);


--
-- Name: idx_recv_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recv_sort ON public.contract_receivable USING btree (contract_out_id, sort_order);


--
-- Name: idx_sup_warranty_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sup_warranty_contract ON public.contract_in_supplier_warranty USING btree (contract_in_id);


--
-- Name: idx_supplier_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_code ON public.supplier USING btree (code);


--
-- Name: idx_supplier_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_name ON public.supplier USING btree (name);


--
-- Name: idx_task_attachment_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_attachment_task ON public.contract_task_attachment USING btree (task_id);


--
-- Name: idx_warranty_activity_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_activity_case ON public.warranty_activity USING btree (case_id);


--
-- Name: idx_warranty_case_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_case_contract ON public.warranty_case USING btree (contract_out_id);


--
-- Name: idx_warranty_case_equipment_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_case_equipment_case ON public.warranty_case_equipment USING btree (case_id);


--
-- Name: idx_warranty_claim_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_claim_contract ON public.contract_in_warranty_claim USING btree (contract_in_id);


--
-- Name: uq_delivery_serial_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_delivery_serial_no ON public.contract_in_delivery_serial USING btree (lower(TRIM(BOTH FROM serial_no)));


--
-- Name: uq_equipment_serial_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_equipment_serial_no ON public.equipment_serial USING btree (lower(TRIM(BOTH FROM serial_no)));


--
-- Name: contract_equipment contract_equipment_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_equipment
    ADD CONSTRAINT contract_equipment_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_guarantee contract_guarantee_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_guarantee
    ADD CONSTRAINT contract_guarantee_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_in_boq contract_in_boq_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_boq
    ADD CONSTRAINT contract_in_boq_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in contract_in_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in
    ADD CONSTRAINT contract_in_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_in_customs contract_in_customs_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_customs
    ADD CONSTRAINT contract_in_customs_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_delivery contract_in_delivery_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery
    ADD CONSTRAINT contract_in_delivery_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_delivery_item contract_in_delivery_item_boq_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_item
    ADD CONSTRAINT contract_in_delivery_item_boq_item_id_fkey FOREIGN KEY (boq_item_id) REFERENCES public.contract_in_boq(id) ON DELETE SET NULL;


--
-- Name: contract_in_delivery_item contract_in_delivery_item_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_item
    ADD CONSTRAINT contract_in_delivery_item_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.contract_in_delivery(id) ON DELETE CASCADE;


--
-- Name: contract_in_delivery_serial contract_in_delivery_serial_delivery_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_serial
    ADD CONSTRAINT contract_in_delivery_serial_delivery_item_id_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.contract_in_delivery_item(id) ON DELETE CASCADE;


--
-- Name: contract_in_delivery_serial contract_in_delivery_serial_parent_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_serial
    ADD CONSTRAINT contract_in_delivery_serial_parent_serial_id_fkey FOREIGN KEY (parent_serial_id) REFERENCES public.contract_in_delivery_serial(id) ON DELETE SET NULL;


--
-- Name: contract_in_delivery_serial contract_in_delivery_serial_replaced_by_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_delivery_serial
    ADD CONSTRAINT contract_in_delivery_serial_replaced_by_serial_id_fkey FOREIGN KEY (replaced_by_serial_id) REFERENCES public.contract_in_delivery_serial(id) ON DELETE SET NULL;


--
-- Name: contract_in_guarantee contract_in_guarantee_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_guarantee
    ADD CONSTRAINT contract_in_guarantee_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_logistics contract_in_logistics_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics
    ADD CONSTRAINT contract_in_logistics_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_logistics_update contract_in_logistics_update_logistics_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_logistics_update
    ADD CONSTRAINT contract_in_logistics_update_logistics_id_fkey FOREIGN KEY (logistics_id) REFERENCES public.contract_in_logistics(id) ON DELETE CASCADE;


--
-- Name: contract_in_payable contract_in_payable_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payable
    ADD CONSTRAINT contract_in_payable_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_payment contract_in_payment_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_payment
    ADD CONSTRAINT contract_in_payment_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_progress contract_in_progress_bb_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_progress
    ADD CONSTRAINT contract_in_progress_bb_type_id_fkey FOREIGN KEY (bb_type_id) REFERENCES public.contract_bb_type(id) ON DELETE SET NULL;


--
-- Name: contract_in_progress contract_in_progress_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_progress
    ADD CONSTRAINT contract_in_progress_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in contract_in_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in
    ADD CONSTRAINT contract_in_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(id) ON DELETE SET NULL;


--
-- Name: contract_in_supplier_warranty contract_in_supplier_warranty_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_supplier_warranty
    ADD CONSTRAINT contract_in_supplier_warranty_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_supplier_warranty contract_in_supplier_warranty_delivery_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_supplier_warranty
    ADD CONSTRAINT contract_in_supplier_warranty_delivery_item_id_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.contract_in_delivery_item(id) ON DELETE SET NULL;


--
-- Name: contract_in_warranty_claim contract_in_warranty_claim_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_warranty_claim
    ADD CONSTRAINT contract_in_warranty_claim_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: contract_in_warranty_claim contract_in_warranty_claim_warranty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_in_warranty_claim
    ADD CONSTRAINT contract_in_warranty_claim_warranty_id_fkey FOREIGN KEY (warranty_id) REFERENCES public.contract_in_supplier_warranty(id) ON DELETE SET NULL;


--
-- Name: contract_out contract_out_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: contract_out contract_out_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: contract_out_member contract_out_member_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_out_member contract_out_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: contract_out_progress contract_out_progress_base_bb_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_progress
    ADD CONSTRAINT contract_out_progress_base_bb_type_id_fkey FOREIGN KEY (base_bb_type_id) REFERENCES public.contract_bb_type(id) ON DELETE SET NULL;


--
-- Name: contract_out_progress contract_out_progress_hd_base_bb_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out_progress
    ADD CONSTRAINT contract_out_progress_hd_base_bb_type_id_fkey FOREIGN KEY (hd_base_bb_type_id) REFERENCES public.contract_bb_type(id) ON DELETE SET NULL;


--
-- Name: contract_out contract_out_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- Name: contract_receivable_payment contract_receivable_payment_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_receivable_payment
    ADD CONSTRAINT contract_receivable_payment_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.contract_receivable(id) ON DELETE SET NULL;


--
-- Name: contract_task contract_task_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task
    ADD CONSTRAINT contract_task_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.app_user(id);


--
-- Name: contract_task_attachment contract_task_attachment_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task_attachment
    ADD CONSTRAINT contract_task_attachment_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.contract_task(id) ON DELETE CASCADE;


--
-- Name: contract_task contract_task_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task
    ADD CONSTRAINT contract_task_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_task contract_task_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task
    ADD CONSTRAINT contract_task_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: contract_task contract_task_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_task
    ADD CONSTRAINT contract_task_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: customer customer_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: customer customer_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- Name: document document_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: document_file document_file_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file
    ADD CONSTRAINT document_file_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: document_folder document_folder_contract_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder
    ADD CONSTRAINT document_folder_contract_in_id_fkey FOREIGN KEY (contract_in_id) REFERENCES public.contract_in(id) ON DELETE CASCADE;


--
-- Name: document document_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- Name: equipment_serial equipment_serial_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_serial
    ADD CONSTRAINT equipment_serial_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.contract_equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_serial equipment_serial_parent_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_serial
    ADD CONSTRAINT equipment_serial_parent_serial_id_fkey FOREIGN KEY (parent_serial_id) REFERENCES public.equipment_serial(id) ON DELETE SET NULL;


--
-- Name: equipment_serial equipment_serial_replaced_by_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_serial
    ADD CONSTRAINT equipment_serial_replaced_by_serial_id_fkey FOREIGN KEY (replaced_by_serial_id) REFERENCES public.equipment_serial(id) ON DELETE SET NULL;


--
-- Name: app_user fk_user_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: app_user fk_user_manager; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_manager FOREIGN KEY (manager_id) REFERENCES public.app_user(id);


--
-- Name: app_user fk_user_position; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_position FOREIGN KEY (position_id) REFERENCES public."position"(id);


--
-- Name: warranty_activity warranty_activity_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_activity
    ADD CONSTRAINT warranty_activity_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.warranty_case(id) ON DELETE CASCADE;


--
-- Name: warranty_case warranty_case_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case
    ADD CONSTRAINT warranty_case_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: warranty_case_equipment warranty_case_equipment_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case_equipment
    ADD CONSTRAINT warranty_case_equipment_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.warranty_case(id) ON DELETE CASCADE;


--
-- Name: warranty_case_equipment warranty_case_equipment_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case_equipment
    ADD CONSTRAINT warranty_case_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.contract_equipment(id) ON DELETE CASCADE;


--
-- Name: warranty_case_equipment warranty_case_equipment_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_case_equipment
    ADD CONSTRAINT warranty_case_equipment_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.equipment_serial(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict nRedHhpfeTVIEn8cJ7R3go6cw1VbT3LD7osoHzDfVoag6xC9PizDcpIxRPNscco

