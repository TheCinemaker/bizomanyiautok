import { createClient } from '@supabase/supabase-js';
import { isAllowedAdminEmail } from './config.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const STORAGE_BUCKET = 'car-photos';

/** A rács csak ezeket az oszlopokat használja - a teljes leírást
 *  fölösleges letölteni a listához. */
const LIST_COLUMNS = 'id,created_at,make,model,price,year,mileage,displacement,power,fuel,transmission,color,condition,description,images';

/** Hibaosztály, amit a felület meg tud különböztetni az "üres kínálat"-tól. */
export class DataUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DataUnavailableError';
    this.cause = cause;
  }
}

class DataService {
  constructor() {
    this.supabase = null;
    this.configError = null;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      this.configError = 'Hiányzó Supabase konfiguráció (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
      console.error(this.configError);
      return;
    }

    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (err) {
      this.configError = 'A Supabase kliens nem indult el.';
      console.error(this.configError, err);
    }
  }

  isReady() {
    return Boolean(this.supabase);
  }

  // ---------------------------------------------------------------- Auth ----

  async signIn(email, password) {
    if (!this.supabase) throw new Error(this.configError || 'Nincs adatbázis kapcsolat.');

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      // A Supabase üzenetei angolul jönnek, itt magyarítjuk a gyakoriakat.
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error('Hibás e-mail cím vagy jelszó.');
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error('A fiók még nincs megerősítve.');
      }
      throw new Error(error.message);
    }

    const userEmail = data?.user?.email || '';
    if (!isAllowedAdminEmail(userEmail)) {
      await this.signOut();
      throw new Error('Ez a fiók nem jogosult az adminisztrációs felület használatára.');
    }

    return data.user;
  }

  async signOut() {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }

  async getCurrentUser() {
    if (!this.supabase) return null;
    const { data } = await this.supabase.auth.getSession();
    const user = data?.session?.user || null;
    if (!user) return null;
    return isAllowedAdminEmail(user.email) ? user : null;
  }

  // ----------------------------------------------------------- Lekérdezés ----

  /**
   * @returns {Promise<Array>} az autók listája
   * @throws {DataUnavailableError} ha az adatbázis nem érhető el
   */
  async getCars() {
    if (!this.supabase) {
      throw new DataUnavailableError(this.configError || 'Nincs adatbázis kapcsolat.');
    }

    try {
      const { data, error } = await this.supabase
        .from('cars')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DataUnavailableError('Az adatbázis elutasította a lekérdezést.', error);
      }

      return data || [];
    } catch (err) {
      if (err instanceof DataUnavailableError) throw err;
      throw new DataUnavailableError('Nem sikerült kapcsolódni az adatbázishoz.', err);
    }
  }

  // ---------------------------------------------------------------- Írás ----

  async addCar(carData) {
    if (!this.supabase) throw new Error('Nincs adatbázis kapcsolat.');

    // Az updated_at-ot szándékosan nem a kliens küldi: adatbázis-trigger tartja
    // karban (lásd supabase_setup.sql). Így a mentés akkor sem hasal el, ha a
    // séma még nem tartalmazza az oszlopot.
    const newCar = {
      ...carData,
      id: carData.id || `car-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString()
    };
    delete newCar.updated_at;

    const { data, error } = await this.supabase
      .from('cars')
      .insert([newCar])
      .select();

    if (error) throw this.describeWriteError(error);
    return data ? data[0] : newCar;
  }

  async updateCar(id, carData) {
    if (!this.supabase) throw new Error('Nincs adatbázis kapcsolat.');

    const payload = { ...carData };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;   // trigger állítja be szerveroldalon

    const { data, error } = await this.supabase
      .from('cars')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw this.describeWriteError(error);

    if (!data || data.length === 0) {
      throw new Error('A módosítás nem ment végbe. Lehet, hogy lejárt a bejelentkezés - lépj be újra.');
    }
    return data[0];
  }

  async deleteCar(id) {
    if (!this.supabase) throw new Error('Nincs adatbázis kapcsolat.');

    const { data, error } = await this.supabase
      .from('cars')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw this.describeWriteError(error);

    if (!data || data.length === 0) {
      throw new Error('A törlés nem ment végbe. Lehet, hogy lejárt a bejelentkezés - lépj be újra.');
    }
    return true;
  }

  /** Az RLS elutasítás nyers üzenete semmitmondó, itt érthetőre cseréljük. */
  describeWriteError(error) {
    console.error('Adatbázis írási hiba:', error);
    if (error.code === '42501' || /row-level security|permission denied/i.test(error.message || '')) {
      return new Error('Nincs jogosultság a művelethez. Jelentkezz be újra admin fiókkal.');
    }
    return new Error(error.message || 'Ismeretlen adatbázis hiba.');
  }

  // -------------------------------------------------------------- Storage ----

  /**
   * Feltölt egy már tömörített képet a tárolóba, és visszaadja a nyilvános URL-t.
   * @param {Blob} blob
   * @param {string} carId
   */
  async uploadCarPhoto(blob, carId) {
    if (!this.supabase) throw new Error('Nincs adatbázis kapcsolat.');

    const path = `${carId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;

    const { error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });

    if (error) {
      console.error('Fotó feltöltési hiba:', error);
      throw new Error('A fotó feltöltése nem sikerült: ' + (error.message || ''));
    }

    const { data } = this.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /** Autó törlésekor a hozzá tartozó fotókat is takarítjuk. */
  async deleteCarPhotos(carId) {
    if (!this.supabase) return;
    try {
      const { data: files } = await this.supabase.storage.from(STORAGE_BUCKET).list(carId);
      if (files && files.length > 0) {
        await this.supabase.storage
          .from(STORAGE_BUCKET)
          .remove(files.map(f => `${carId}/${f.name}`));
      }
    } catch (err) {
      // Nem kritikus: az autó már törölve van, az árva fotó csak helyet foglal.
      console.warn('A fotók takarítása nem sikerült:', err);
    }
  }

  // ----------------------------------------------------------- Érdeklődés ----

  async submitInquiry(inquiry) {
    if (!this.supabase) throw new Error('Nincs adatbázis kapcsolat.');

    const { error } = await this.supabase.from('inquiries').insert([inquiry]);

    if (error) {
      console.error('Érdeklődés mentési hiba:', error);
      throw new Error('Az érdeklődést nem sikerült elküldeni. Kérjük, hívjon minket telefonon.');
    }
    return true;
  }
}

export const dbService = new DataService();
