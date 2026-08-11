import { defineConfig } from 'vite';
import { resolve } from 'path';

// Több oldalas build: az index mellett a három jogi oldal is bekerül a dist-be.
// Enélkül a Netlify 404-et ad az impresszum / ÁSZF / adatkezelés linkekre.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impresszum: resolve(__dirname, 'impresszum.html'),
        aszf: resolve(__dirname, 'aszf.html'),
        adatkezeles: resolve(__dirname, 'adatkezeles.html')
      }
    }
  }
});
