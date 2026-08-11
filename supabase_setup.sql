-- ============================================================================
-- MOZSÓ BIZOMÁNYOS AUTÓK - SUPABASE ADATBÁZIS BEÁLLÍTÁS
-- Futtasd a Supabase Dashboard > SQL Editor felületén.
--
-- FONTOS BIZTONSÁGI VÁLTOZÁS A KORÁBBI VERZIÓHOZ KÉPEST:
-- A régi séma nyilvános INSERT / UPDATE / DELETE jogot adott, ami azt
-- jelentette, hogy bárki, aki megnyitotta a böngésző konzolját, kitörölhette
-- a teljes készletet. Mostantól az írás kizárólag bejelentkezett, az
-- admin_users táblában szereplő e-mail címekhez van kötve. Ezt a Postgres
-- kényszeríti ki, nem a JavaScript - így böngészőből megkerülhetetlen.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Admin felhasználók listája
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY,
    role  TEXT NOT NULL DEFAULT 'owner',   -- 'admin' (fejlesztő) vagy 'owner' (megrendelő)
    note  TEXT
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- Szándékosan NINCS policy: így a tábla a kliens felől teljesen láthatatlan,
-- csak a szerveroldali policy-k és a service_role fér hozzá.

-- >>> ÍRD ÁT A KÉT E-MAIL CÍMET A SAJÁTOTOKRA <<<
INSERT INTO public.admin_users (email, role, note) VALUES
    ('fejleszto@pelda.hu',   'admin', 'SA Software & Network Solutions - fejlesztő'),
    ('tulajdonos@pelda.hu',  'owner', 'MOZSÓ Bizományos Autók - megrendelő')
ON CONFLICT (email) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Segédfüggvény: a belépett felhasználó admin-e?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    );
$$;


-- ----------------------------------------------------------------------------
-- 3. 'cars' tábla
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cars (
    id           TEXT PRIMARY KEY,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    make         TEXT NOT NULL,
    model        TEXT NOT NULL,
    price        NUMERIC NOT NULL,
    year         INT DEFAULT 2024,
    mileage      INT DEFAULT 0,
    displacement INT DEFAULT 0,
    power        INT DEFAULT 0,
    fuel         TEXT,
    transmission TEXT,
    color        TEXT,
    condition    TEXT DEFAULT 'Kitűnő',
    description  TEXT,
    images       JSONB DEFAULT '[]'::jsonb
);

-- Korábbi telepítésből hiányozhat:
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Az updated_at-ot az adatbázis tartja karban, nem a kliens. Így a mentés
-- akkor sem hasal el, ha a séma és a kliens verziója eltér.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cars_touch_updated_at ON public.cars;
CREATE TRIGGER cars_touch_updated_at
    BEFORE UPDATE ON public.cars
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Rendezéshez / szűréshez
CREATE INDEX IF NOT EXISTS cars_created_at_idx ON public.cars (created_at DESC);
CREATE INDEX IF NOT EXISTS cars_make_idx       ON public.cars (make);


-- ----------------------------------------------------------------------------
-- 4. RLS a 'cars' táblán
-- ----------------------------------------------------------------------------
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- A régi, nyitott policy-k eltávolítása (ha léteznek)
DROP POLICY IF EXISTS "Allow public read access"   ON public.cars;
DROP POLICY IF EXISTS "Allow public insert access" ON public.cars;
DROP POLICY IF EXISTS "Allow public update access" ON public.cars;
DROP POLICY IF EXISTS "Allow public delete access" ON public.cars;

DROP POLICY IF EXISTS "cars_public_read"  ON public.cars;
DROP POLICY IF EXISTS "cars_admin_insert" ON public.cars;
DROP POLICY IF EXISTS "cars_admin_update" ON public.cars;
DROP POLICY IF EXISTS "cars_admin_delete" ON public.cars;

-- Olvasás: mindenkinek (ez a nyilvános kínálat)
CREATE POLICY "cars_public_read" ON public.cars
    FOR SELECT USING (true);

-- Írás: kizárólag belépett adminnak
CREATE POLICY "cars_admin_insert" ON public.cars
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "cars_admin_update" ON public.cars
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "cars_admin_delete" ON public.cars
    FOR DELETE TO authenticated USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 5. Fotótároló (Storage)
--    A fotók mostantól NEM base64-ként kerülnek az adatbázisba, hanem
--    tárolóba, és csak az URL-jük megy a 'cars.images' mezőbe.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-photos', 'car-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "car_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "car_photos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "car_photos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "car_photos_admin_delete" ON storage.objects;

CREATE POLICY "car_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'car-photos');

CREATE POLICY "car_photos_admin_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'car-photos' AND public.is_admin());

CREATE POLICY "car_photos_admin_update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'car-photos' AND public.is_admin());

CREATE POLICY "car_photos_admin_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'car-photos' AND public.is_admin());


-- ----------------------------------------------------------------------------
-- 6. Érdeklődések tábla
--    A vevő "Érdeklődés" gombja mostantól valóban rögzít egy megkeresést.
--    Beírni bárki tud (ez a lényege), de olvasni csak az admin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inquiries (
    id         BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    car_id     TEXT,
    car_label  TEXT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    email      TEXT,
    message    TEXT,
    handled    BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiries_public_insert" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_admin_read"    ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_admin_update"  ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_admin_delete"  ON public.inquiries;

CREATE POLICY "inquiries_public_insert" ON public.inquiries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "inquiries_admin_read" ON public.inquiries
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "inquiries_admin_update" ON public.inquiries
    FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "inquiries_admin_delete" ON public.inquiries
    FOR DELETE TO authenticated USING (public.is_admin());


-- ============================================================================
-- TEENDŐ A FUTTATÁS UTÁN
--
-- 1. Írd át a 1. pontban a két e-mail címet a valódiakra.
--
-- 2. Hozd létre a két felhasználót:
--    Supabase Dashboard > Authentication > Users > "Add user"
--    -> "Auto Confirm User" bekapcsolva, e-mail + erős jelszó.
--    A címeknek egyezniük kell az admin_users táblában lévőkkel.
--
-- 3. Authentication > Providers > Email:
--    kapcsold KI az "Enable Sign Ups" opciót, hogy senki ne
--    tudjon magának fiókot regisztrálni.
--
-- 4. Ellenőrzés: jelentkezz ki az oldalon, nyisd meg a konzolt és próbálj
--    törölni egy autót. A Supabase-nek el kell utasítania.
-- ============================================================================
