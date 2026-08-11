import { createClient } from '@supabase/supabase-js';
import { INITIAL_CARS } from '../data/initialCars.js';

const STORAGE_KEY = 'apex_motors_cars';
const SUPABASE_CONFIG_KEY = 'apex_motors_supabase_config';

class DataService {
  constructor() {
    this.supabase = null;
    this.initSupabase();
    this.initLocalStorage();
  }

  getSupabaseConfig() {
    try {
      const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
      return saved ? JSON.parse(saved) : { url: '', key: '' };
    } catch (e) {
      return { url: '', key: '' };
    }
  }

  initSupabase() {
    const config = this.getSupabaseConfig();
    if (config.url && config.key) {
      try {
        this.supabase = createClient(config.url, config.key);
      } catch (err) {
        console.warn('Supabase client failed to initialize, using local mode', err);
        this.supabase = null;
      }
    }
  }

  saveSupabaseConfig(url, key) {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, key }));
    this.initSupabase();
  }

  initLocalStorage() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CARS));
    }
  }

  async getCars() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('cars')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, fallback to local storage:', err);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL_CARS;
    } catch (e) {
      return INITIAL_CARS;
    }
  }

  async addCar(carData) {
    const newCar = {
      ...carData,
      id: carData.id || `car-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('cars')
          .insert([newCar])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          // Also sync to local storage
          this.addLocalCar(data[0]);
          return data[0];
        }
      } catch (err) {
        console.warn('Supabase insert error, saving locally:', err);
      }
    }

    return this.addLocalCar(newCar);
  }

  addLocalCar(car) {
    const cars = this.getLocalCars();
    const updated = [car, ...cars];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return car;
  }

  async deleteCar(id) {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('cars')
          .delete()
          .eq('id', id);

        if (error) console.warn('Supabase delete error:', error);
      } catch (err) {
        console.warn('Supabase connection error on delete:', err);
      }
    }

    const cars = this.getLocalCars();
    const filtered = cars.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }

  getLocalCars() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL_CARS;
    } catch (e) {
      return INITIAL_CARS;
    }
  }

  resetToDefault() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CARS));
  }
}

export const dbService = new DataService();
