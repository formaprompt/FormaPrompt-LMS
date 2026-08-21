-- Fixture CI uniquement : table historique antérieure aux migrations suivies.
CREATE TABLE public.calendar_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  slot text NOT NULL,
  type text NOT NULL DEFAULT 'option',
  of_name text NOT NULL,
  comments text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.calendar_bookings ENABLE ROW LEVEL SECURITY;
