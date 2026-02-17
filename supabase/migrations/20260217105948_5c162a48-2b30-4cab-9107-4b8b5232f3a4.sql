
-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL,
  host_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id, guest_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations: participants can view
CREATE POLICY "Participants can view conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = guest_id OR auth.uid() = host_id);

-- Conversations: guests can create
CREATE POLICY "Guests can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = guest_id);

-- Messages: participants can view
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = messages.conversation_id
  AND (c.guest_id = auth.uid() OR c.host_id = auth.uid())
));

-- Messages: participants can send
CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
    AND (c.guest_id = auth.uid() OR c.host_id = auth.uid())
  )
);

-- Update trigger for conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
