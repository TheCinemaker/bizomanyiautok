/**
 * Központi konfiguráció.
 * Az értékek a Netlify környezeti változóiból jönnek (build időben égnek be).
 * Lásd: .env.example
 */

const env = import.meta.env;

/** Admin belépésre jogosult címek. Csak a felület szűrésére szolgál -
 *  a tényleges védelmet a Postgres RLS adja (supabase_setup.sql). */
export const ADMIN_EMAILS = [
  env.VITE_ADMIN_EMAIL,
  env.VITE_OWNER_EMAIL
].filter(Boolean).map(e => e.trim().toLowerCase());

export function isAllowedAdminEmail(email) {
  if (!email) return false;
  // A jogosultságokat a Supabase Postgres RLS (admin_users tábla) kezeli.
  return true;
}

/** Kereskedés nyilvános elérhetőségei. */
export const CONTACT = {
  phone: env.VITE_CONTACT_PHONE || '',
  email: env.VITE_CONTACT_EMAIL || ''
};

/** Telefonszám tel: linkhez (szóközök, kötőjelek nélkül). */
export function phoneHref() {
  return CONTACT.phone ? `tel:${CONTACT.phone.replace(/[^\d+]/g, '')}` : '';
}

/** Telefonszám olvasható formában: +36 30 123 4567 */
export function phoneDisplay() {
  const raw = CONTACT.phone.replace(/[^\d+]/g, '');
  const m = raw.match(/^\+36(\d{2})(\d{3})(\d{4})$/);
  return m ? `+36 ${m[1]} ${m[2]} ${m[3]}` : CONTACT.phone;
}

/** Fotó feltöltési korlátok. */
export const IMAGE_UPLOAD = {
  maxDimension: 1600,   // px, a hosszabbik oldal
  quality: 0.82,        // JPEG minőség
  maxFiles: 20
};
