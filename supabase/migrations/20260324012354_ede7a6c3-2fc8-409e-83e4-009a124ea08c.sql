ALTER TABLE public.woo_connections ADD COLUMN response_language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE public.woo_connections ADD COLUMN openai_api_key TEXT;