--
-- PostgreSQL database dump
--

\restrict EFqGyrmS5CMBCsMNxkqgROCFzuuNzUijrlrwdD71gVCJegYaSdJDj7ZDK9sCtBK

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-05-31 17:53:36

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
-- TOC entry 220 (class 1259 OID 17275)
-- Name: app_user; Type: TABLE; Schema: public; Owner: postgres
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
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_user OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 17274)
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_user_id_seq OWNER TO postgres;

--
-- TOC entry 5133 (class 0 OID 0)
-- Dependencies: 219
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
-- TOC entry 228 (class 1259 OID 17376)
-- Name: contract_out; Type: TABLE; Schema: public; Owner: postgres
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
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.contract_out OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 17375)
-- Name: contract_out_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_out_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_out_id_seq OWNER TO postgres;

--
-- TOC entry 5134 (class 0 OID 0)
-- Dependencies: 227
-- Name: contract_out_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_out_id_seq OWNED BY public.contract_out.id;


--
-- TOC entry 230 (class 1259 OID 17413)
-- Name: contract_out_member; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.contract_out_member OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 17412)
-- Name: contract_out_member_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_out_member_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_out_member_id_seq OWNER TO postgres;

--
-- TOC entry 5135 (class 0 OID 0)
-- Dependencies: 229
-- Name: contract_out_member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_out_member_id_seq OWNED BY public.contract_out_member.id;


--
-- TOC entry 226 (class 1259 OID 17350)
-- Name: customer; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.customer OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 17349)
-- Name: customer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_id_seq OWNER TO postgres;

--
-- TOC entry 5136 (class 0 OID 0)
-- Dependencies: 225
-- Name: customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_id_seq OWNED BY public.customer.id;


--
-- TOC entry 222 (class 1259 OID 17289)
-- Name: department; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.department OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 17288)
-- Name: department_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.department_id_seq OWNER TO postgres;

--
-- TOC entry 5137 (class 0 OID 0)
-- Dependencies: 221
-- Name: department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.department_id_seq OWNED BY public.department.id;


--
-- TOC entry 232 (class 1259 OID 17439)
-- Name: document; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.document OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 17481)
-- Name: document_file; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_file (
    id integer NOT NULL,
    contract_id bigint NOT NULL,
    folder_id bigint NOT NULL,
    file_name character varying(500),
    file_path character varying(1000),
    file_size bigint,
    mime_type character varying(100),
    uploaded_by bigint,
    uploaded_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.document_file OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 17480)
-- Name: document_file_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_file_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_file_id_seq OWNER TO postgres;

--
-- TOC entry 5138 (class 0 OID 0)
-- Dependencies: 235
-- Name: document_file_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_file_id_seq OWNED BY public.document_file.id;


--
-- TOC entry 234 (class 1259 OID 17470)
-- Name: document_folder; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_folder (
    id integer NOT NULL,
    contract_id bigint NOT NULL,
    parent_id bigint,
    folder_name character varying(255) NOT NULL,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.document_folder OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 17469)
-- Name: document_folder_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_folder_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_folder_id_seq OWNER TO postgres;

--
-- TOC entry 5139 (class 0 OID 0)
-- Dependencies: 233
-- Name: document_folder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_folder_id_seq OWNED BY public.document_folder.id;


--
-- TOC entry 231 (class 1259 OID 17438)
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_id_seq OWNER TO postgres;

--
-- TOC entry 5140 (class 0 OID 0)
-- Dependencies: 231
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
-- TOC entry 224 (class 1259 OID 17307)
-- Name: position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."position" (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    level_no integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."position" OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 17306)
-- Name: position_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.position_id_seq OWNER TO postgres;

--
-- TOC entry 5141 (class 0 OID 0)
-- Dependencies: 223
-- Name: position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.position_id_seq OWNED BY public."position".id;


--
-- TOC entry 4896 (class 2604 OID 17278)
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- TOC entry 4912 (class 2604 OID 17379)
-- Name: contract_out id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out ALTER COLUMN id SET DEFAULT nextval('public.contract_out_id_seq'::regclass);


--
-- TOC entry 4920 (class 2604 OID 17416)
-- Name: contract_out_member id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member ALTER COLUMN id SET DEFAULT nextval('public.contract_out_member_id_seq'::regclass);


--
-- TOC entry 4909 (class 2604 OID 17353)
-- Name: customer id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer ALTER COLUMN id SET DEFAULT nextval('public.customer_id_seq'::regclass);


--
-- TOC entry 4902 (class 2604 OID 17292)
-- Name: department id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department ALTER COLUMN id SET DEFAULT nextval('public.department_id_seq'::regclass);


--
-- TOC entry 4924 (class 2604 OID 17442)
-- Name: document id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- TOC entry 4929 (class 2604 OID 17484)
-- Name: document_file id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_file ALTER COLUMN id SET DEFAULT nextval('public.document_file_id_seq'::regclass);


--
-- TOC entry 4927 (class 2604 OID 17473)
-- Name: document_folder id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_folder ALTER COLUMN id SET DEFAULT nextval('public.document_folder_id_seq'::regclass);


--
-- TOC entry 4906 (class 2604 OID 17310)
-- Name: position id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position" ALTER COLUMN id SET DEFAULT nextval('public.position_id_seq'::regclass);


--
-- TOC entry 4932 (class 2606 OID 17287)
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- TOC entry 4934 (class 2606 OID 17285)
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- TOC entry 4950 (class 2606 OID 17396)
-- Name: contract_out contract_out_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_contract_no_key UNIQUE (contract_no);


--
-- TOC entry 4957 (class 2606 OID 17425)
-- Name: contract_out_member contract_out_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_pkey PRIMARY KEY (id);


--
-- TOC entry 4952 (class 2606 OID 17394)
-- Name: contract_out contract_out_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_pkey PRIMARY KEY (id);


--
-- TOC entry 4946 (class 2606 OID 17364)
-- Name: customer customer_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_code_key UNIQUE (code);


--
-- TOC entry 4948 (class 2606 OID 17362)
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 17305)
-- Name: department department_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_code_key UNIQUE (code);


--
-- TOC entry 4940 (class 2606 OID 17303)
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- TOC entry 4968 (class 2606 OID 17492)
-- Name: document_file document_file_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_file
    ADD CONSTRAINT document_file_pkey PRIMARY KEY (id);


--
-- TOC entry 4966 (class 2606 OID 17479)
-- Name: document_folder document_folder_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_folder
    ADD CONSTRAINT document_folder_pkey PRIMARY KEY (id);


--
-- TOC entry 4963 (class 2606 OID 17452)
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- TOC entry 4942 (class 2606 OID 17322)
-- Name: position position_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_code_key UNIQUE (code);


--
-- TOC entry 4944 (class 2606 OID 17320)
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- TOC entry 4936 (class 2606 OID 17333)
-- Name: app_user uq_app_user_username; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT uq_app_user_username UNIQUE (username);


--
-- TOC entry 4961 (class 2606 OID 17427)
-- Name: contract_out_member uq_contract_member; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT uq_contract_member UNIQUE (contract_out_id, user_id, member_role);


--
-- TOC entry 4958 (class 1259 OID 17466)
-- Name: idx_contract_member_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_member_contract ON public.contract_out_member USING btree (contract_out_id);


--
-- TOC entry 4959 (class 1259 OID 17467)
-- Name: idx_contract_member_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_member_user ON public.contract_out_member USING btree (user_id);


--
-- TOC entry 4953 (class 1259 OID 17464)
-- Name: idx_contract_out_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_customer ON public.contract_out USING btree (customer_id);


--
-- TOC entry 4954 (class 1259 OID 17463)
-- Name: idx_contract_out_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_no ON public.contract_out USING btree (contract_no);


--
-- TOC entry 4955 (class 1259 OID 17465)
-- Name: idx_contract_out_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_status ON public.contract_out USING btree (status);


--
-- TOC entry 4964 (class 1259 OID 17468)
-- Name: idx_document_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_contract ON public.document USING btree (contract_out_id);


--
-- TOC entry 4974 (class 2606 OID 17402)
-- Name: contract_out contract_out_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- TOC entry 4975 (class 2606 OID 17397)
-- Name: contract_out contract_out_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- TOC entry 4977 (class 2606 OID 17428)
-- Name: contract_out_member contract_out_member_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- TOC entry 4978 (class 2606 OID 17433)
-- Name: contract_out_member contract_out_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- TOC entry 4976 (class 2606 OID 17407)
-- Name: contract_out contract_out_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- TOC entry 4972 (class 2606 OID 17365)
-- Name: customer customer_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- TOC entry 4973 (class 2606 OID 17370)
-- Name: customer customer_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- TOC entry 4979 (class 2606 OID 17453)
-- Name: document document_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- TOC entry 4980 (class 2606 OID 17458)
-- Name: document document_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- TOC entry 4969 (class 2606 OID 17334)
-- Name: app_user fk_user_department; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- TOC entry 4970 (class 2606 OID 17344)
-- Name: app_user fk_user_manager; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_manager FOREIGN KEY (manager_id) REFERENCES public.app_user(id);


--
-- TOC entry 4971 (class 2606 OID 17339)
-- Name: app_user fk_user_position; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_position FOREIGN KEY (position_id) REFERENCES public."position"(id);


-- Completed on 2026-05-31 17:53:37

--
-- PostgreSQL database dump complete
--

\unrestrict EFqGyrmS5CMBCsMNxkqgROCFzuuNzUijrlrwdD71gVCJegYaSdJDj7ZDK9sCtBK

