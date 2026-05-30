--
-- PostgreSQL database dump
--

\restrict RrN5bupNFakM5PGHdvRmjvrFF8YnNCB7MyymVkEQ5aHH7SzRQNld1hJwrzKtC0B

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
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
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
-- Name: contract_out_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_out_id_seq OWNED BY public.contract_out.id;


--
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
-- Name: contract_out_member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_out_member_id_seq OWNED BY public.contract_out_member.id;


--
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
-- Name: customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_id_seq OWNED BY public.customer.id;


--
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
-- Name: department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.department_id_seq OWNED BY public.department.id;


--
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
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
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
-- Name: position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.position_id_seq OWNED BY public."position".id;


--
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- Name: contract_out id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out ALTER COLUMN id SET DEFAULT nextval('public.contract_out_id_seq'::regclass);


--
-- Name: contract_out_member id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member ALTER COLUMN id SET DEFAULT nextval('public.contract_out_member_id_seq'::regclass);


--
-- Name: customer id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer ALTER COLUMN id SET DEFAULT nextval('public.customer_id_seq'::regclass);


--
-- Name: department id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department ALTER COLUMN id SET DEFAULT nextval('public.department_id_seq'::regclass);


--
-- Name: document id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- Name: position id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position" ALTER COLUMN id SET DEFAULT nextval('public.position_id_seq'::regclass);


--
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: contract_out contract_out_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_contract_no_key UNIQUE (contract_no);


--
-- Name: contract_out_member contract_out_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_pkey PRIMARY KEY (id);


--
-- Name: contract_out contract_out_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_pkey PRIMARY KEY (id);


--
-- Name: customer customer_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_code_key UNIQUE (code);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: department department_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_code_key UNIQUE (code);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: position position_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_code_key UNIQUE (code);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- Name: app_user uq_app_user_username; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT uq_app_user_username UNIQUE (username);


--
-- Name: contract_out_member uq_contract_member; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT uq_contract_member UNIQUE (contract_out_id, user_id, member_role);


--
-- Name: idx_contract_member_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_member_contract ON public.contract_out_member USING btree (contract_out_id);


--
-- Name: idx_contract_member_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_member_user ON public.contract_out_member USING btree (user_id);


--
-- Name: idx_contract_out_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_customer ON public.contract_out USING btree (customer_id);


--
-- Name: idx_contract_out_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_no ON public.contract_out USING btree (contract_no);


--
-- Name: idx_contract_out_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_out_status ON public.contract_out USING btree (status);


--
-- Name: idx_document_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_contract ON public.document USING btree (contract_out_id);


--
-- Name: contract_out contract_out_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: contract_out contract_out_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: contract_out_member contract_out_member_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: contract_out_member contract_out_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out_member
    ADD CONSTRAINT contract_out_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: contract_out contract_out_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_out
    ADD CONSTRAINT contract_out_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- Name: customer customer_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: customer customer_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user(id);


--
-- Name: document document_contract_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_contract_out_id_fkey FOREIGN KEY (contract_out_id) REFERENCES public.contract_out(id) ON DELETE CASCADE;


--
-- Name: document document_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- Name: app_user fk_user_department; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: app_user fk_user_manager; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_manager FOREIGN KEY (manager_id) REFERENCES public.app_user(id);


--
-- Name: app_user fk_user_position; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_user_position FOREIGN KEY (position_id) REFERENCES public."position"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict RrN5bupNFakM5PGHdvRmjvrFF8YnNCB7MyymVkEQ5aHH7SzRQNld1hJwrzKtC0B

