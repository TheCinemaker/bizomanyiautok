-- ================================================
-- APEX MOTORS - SUPABASE DATABASE SETUP SCRIPT
-- Project URL: https://qceznytdsqdcodgrgoxd.supabase.co
-- Run this script in your Supabase SQL Editor!
-- ================================================

-- 1. Create 'cars' table
CREATE TABLE IF NOT EXISTS public.cars (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    price NUMERIC NOT NULL,
    year INT DEFAULT 2024,
    mileage INT DEFAULT 0,
    displacement INT DEFAULT 0,
    power INT DEFAULT 0,
    fuel TEXT,
    transmission TEXT,
    color TEXT,
    condition TEXT DEFAULT 'Kitűnő',
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for Public Access (Read, Insert, Update, Delete)
CREATE POLICY "Allow public read access" ON public.cars
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.cars
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.cars
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.cars
    FOR DELETE USING (true);

-- 4. Seed Initial Luxury Cars Data
INSERT INTO public.cars (id, make, model, year, mileage, displacement, power, fuel, transmission, price, color, condition, description, images)
VALUES 
(
  'car-bmw-m4',
  'BMW',
  'M4 Competition xDrive',
  2024,
  8500,
  2993,
  510,
  'Benzin',
  'Automata',
  38900000,
  'Dravit Grey Metallic',
  'Kitűnő',
  'Sérülésmentes, hivatalos márkaszervizben szervizelt BMW M4 Competition. M Carbon kerámia fékrendszer, M Carbon kagylóülések, Harman Kardon Hifi, Head-Up Display.',
  '["https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=85", "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=85"]'::jsonb
),
(
  'car-merc-amg-gt',
  'Mercedes-Benz',
  'AMG GT 63 S 4MATIC+',
  2023,
  14200,
  3982,
  639,
  'Benzin',
  'Automata',
  54500000,
  'Designo Matt Fekete',
  'Újszerű',
  'Mercedes-AMG GT 63 S V8 BiTurbo 639LE. AMG Performance kipufogórendszer, kerámia fékek, sárga varrással ellátott Nappa bőr belső, Burmester 3D Surround.',
  '["https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=85", "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85"]'::jsonb
),
(
  'car-audi-rs6',
  'Audi',
  'RS6 Avant Dynamic Performance',
  2024,
  5100,
  3996,
  600,
  'Hibrid',
  'Automata',
  49900000,
  'Nardo Szürke',
  'Újszerű',
  'Audi RS6 Avant Mild Hybrid. Bang & Olufsen 3D Advanced Sound System, RS sportkipufogó, DRC sportfutómű, Panorámatető.',
  '["https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1200&q=85"]'::jsonb
),
(
  'car-porsche-911',
  'Porsche',
  '911 Carrera GTS Coupe',
  2023,
  11800,
  2981,
  480,
  'Benzin',
  'Automata',
  61900000,
  'GT Silver Metallic',
  'Kitűnő',
  'Porsche 911 992 Carrera GTS PDK. GTS belső csomag Race-Tex elemekkel, PASM sportfutómű -10mm, Sport Chrono csomag.',
  '["https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
