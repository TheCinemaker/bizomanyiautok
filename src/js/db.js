import { createClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_KEY = 'apex_motors_supabase_config';

const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qceznytdsqdcodgrgoxd.supabase.co';
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZXpueXRkc3FkY29kZ3Jnb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTc5NjgsImV4cCI6MjEwMTk5Mzk2OH0.9G0LFIdQ_l447QQLx7hLgEhfPYayZCPYJ11Y1fSr1eE';

class DataService {
  constructor() {
    this.supabase = null;
    this.initSupabase();
  }

  getSupabaseConfig() {
    try {
      const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.key) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY };
  }

  initSupabase() {
    const config = this.getSupabaseConfig();
    if (config.url && config.key) {
      try {
        this.supabase = createClient(config.url, config.key);
      } catch (err) {
        console.warn('Supabase client failed to initialize:', err);
        this.supabase = null;
      }
    }
  }

  saveSupabaseConfig(url, key) {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, key }));
    this.initSupabase();
  }

  async getCars() {
    if (!this.supabase) {
      console.warn('Supabase is not configured.');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Hiba az autók lekérésekor a Supabase-ből:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Supabase hálózati / lekérdezési hiba:', err);
      return [];
    }
  }

  async addCar(carData) {
    if (!this.supabase) {
      throw new Error('Supabase adatbázis kapcsolat nem elérhető!');
    }

    const newCar = {
      ...carData,
      id: carData.id || `car-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('cars')
      .insert([newCar])
      .select();

    if (error) {
      console.error('Hiba az autó mentésekor a Supabase-ben:', error);
      throw error;
    }

    return data ? data[0] : newCar;
  }

  async deleteCar(id) {
    if (!this.supabase) {
      console.error('Supabase kapcsolat hiányzik');
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('cars')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Hiba a Supabase törlésnél:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Supabase kapcsolódási hiba törléskor:', err);
      return false;
    }
  }
}

export const dbService = new DataService();

