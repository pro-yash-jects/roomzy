
-- Add cancellation_reason and cancelled_by columns to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- Allow hosts to update bookings on their listings (for cancellation)
CREATE POLICY "Hosts can update bookings on their listings"
ON public.bookings
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM listings
  WHERE listings.id = bookings.listing_id AND listings.host_id = auth.uid()
));
