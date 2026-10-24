-- Tabla del histórico de ediciones archivadas (cron archivarEdiciones).
-- No viene en el respaldo BD_PAMCE_UFPS.backup del 09/10/2026: ejecutar una vez en la base.

CREATE TABLE public.historico_ediciones (
    id_historico integer NOT NULL,
    id_edicion integer NOT NULL,
    nombre_edicion character varying(45) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    total_categorias integer DEFAULT 0 NOT NULL,
    total_postulaciones integer DEFAULT 0 NOT NULL,
    total_participaciones integer DEFAULT 0 NOT NULL,
    total_jurados integer DEFAULT 0 NOT NULL,
    total_evaluaciones integer DEFAULT 0 NOT NULL,
    total_documentos integer DEFAULT 0 NOT NULL,
    bytes_documentos_liberados bigint DEFAULT 0 NOT NULL,
    datos json NOT NULL,
    checksum character(64) NOT NULL,
    version_esquema integer DEFAULT 1 NOT NULL,
    tamano_json_bytes bigint DEFAULT 0 NOT NULL,
    archivos_no_eliminados json DEFAULT '[]'::json NOT NULL,
    fecha_archivado timestamp with time zone NOT NULL,
    archivado_por integer
);
CREATE SEQUENCE public.historico_ediciones_id_historico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.historico_ediciones_id_historico_seq OWNED BY public.historico_ediciones.id_historico;
ALTER TABLE ONLY public.historico_ediciones ALTER COLUMN id_historico SET DEFAULT nextval('public.historico_ediciones_id_historico_seq'::regclass);
ALTER TABLE ONLY public.historico_ediciones
    ADD CONSTRAINT historico_ediciones_id_edicion_key UNIQUE (id_edicion);
ALTER TABLE ONLY public.historico_ediciones
    ADD CONSTRAINT historico_ediciones_pkey PRIMARY KEY (id_historico);
