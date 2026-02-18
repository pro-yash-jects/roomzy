
CREATE TABLE public.deletion_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own deletion codes"
  ON public.deletion_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "No direct inserts from client"
  ON public.deletion_codes FOR INSERT
  WITH CHECK (false);
