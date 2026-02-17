
-- Create a function to prevent double-booking of rooms
CREATE OR REPLACE FUNCTION public.prevent_room_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if room_id is provided
  IF NEW.room_id IS NOT NULL AND NEW.status != 'cancelled' THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE room_id = NEW.room_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status != 'cancelled'
        AND check_in < NEW.check_out
        AND check_out > NEW.check_in
    ) THEN
      RAISE EXCEPTION 'This room is already booked for the selected dates';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on bookings table
CREATE TRIGGER check_room_double_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_room_double_booking();
