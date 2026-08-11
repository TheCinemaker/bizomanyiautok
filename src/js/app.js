import { dbService } from './db.js';
import { createCarCard } from './components/CarCard.js';
import { CarModal } from './components/CarModal.js';
import { FilterDrawer } from './components/FilterDrawer.js';
import { AdminPanel } from './components/AdminPanel.js';
import { CONTACT, phoneHref, phoneDisplay } from './config.js';

const SKELETON_COUNT = 6;

class App {
  constructor() {
    this.cars = [];
    this.loadError = null;

    this.carModal = new CarModal({
      onOpen: (car) => this.setHashForCar(car),
      onClose: () => this.clearHash()
    });

    this.filterDrawer = new FilterDrawer({
      onFilterChange: () => this.renderCarList()
    });

    this.adminPanel = new AdminPanel({
      onCarsUpdated: () => this.loadAndRenderCars()
    });

    this.init();
  }

  async init() {
    this.renderContactBar();
    this.bindGlobalEvents();
    await this.loadAndRenderCars();
    this.openCarFromHash();
  }

  // ------------------------------------------------------------ Kapcsolat ----

  /** A telefonszám a fejlécben - egy kereskedésnél ez a fő konverziós elem. */
  renderContactBar() {
    const container = document.getElementById('header-actions');
    if (!container || !CONTACT.phone) return;

    container.innerHTML = `
      <a href="${phoneHref()}" class="header-phone-btn">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span class="header-phone-number">${phoneDisplay()}</span>
      </a>
    `;
  }

  bindGlobalEvents() {
    const scrollTopBtn = document.getElementById('btn-scroll-top');
    if (scrollTopBtn) {
      // Görgetéskor ne fusson minden képkockán elemzés.
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
          ticking = false;
        });
      }, { passive: true });

      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    document.getElementById('btn-reset-filters')
      ?.addEventListener('click', () => this.filterDrawer.resetFilters());

    document.getElementById('btn-retry-load')
      ?.addEventListener('click', () => this.loadAndRenderCars());

    // Vissza gomb / megosztott link kezelése
    window.addEventListener('hashchange', () => this.openCarFromHash());
  }

  // ------------------------------------------------------ Mély hivatkozás ----

  setHashForCar(car) {
    const target = `#auto/${encodeURIComponent(car.id)}`;
    if (location.hash !== target) history.pushState(null, '', target);
  }

  clearHash() {
    if (location.hash.startsWith('#auto/')) {
      history.pushState(null, '', location.pathname + location.search);
    }
  }

  openCarFromHash() {
    const match = location.hash.match(/^#auto\/(.+)$/);

    if (!match) {
      if (this.carModal.isOpen()) this.carModal.close();
      return;
    }

    const id = decodeURIComponent(match[1]);
    const car = this.cars.find(c => c.id === id);
    if (car && this.carModal.currentCar?.id !== id) {
      this.carModal.open(car);
    }
  }

  // ------------------------------------------------------------ Betöltés ----

  async loadAndRenderCars() {
    this.showSkeletons();
    this.loadError = null;

    try {
      this.cars = await dbService.getCars();
    } catch (err) {
      // Fontos: a kapcsolati hiba nem ugyanaz, mint az "üres találat".
      console.error(err);
      this.cars = [];
      this.loadError = err;
    }

    this.filterDrawer.setAvailableOptions(this.cars);
    this.renderCarList();
  }

  showSkeletons() {
    const grid = document.getElementById('cars-grid');
    if (!grid) return;

    this.setStateVisibility({ empty: false, error: false });
    document.getElementById('car-count').textContent = 'Kínálat betöltése...';

    grid.innerHTML = Array.from({ length: SKELETON_COUNT }).map(() => `
      <div class="car-card-skeleton" aria-hidden="true">
        <div class="skeleton-media"></div>
        <div class="skeleton-body">
          <div class="skeleton-line skeleton-line-lg"></div>
          <div class="skeleton-line skeleton-line-sm"></div>
          <div class="skeleton-line skeleton-line-md"></div>
        </div>
      </div>
    `).join('');
  }

  setStateVisibility({ empty, error }) {
    const emptyEl = document.getElementById('empty-state');
    const errorEl = document.getElementById('error-state');
    if (emptyEl) emptyEl.hidden = !empty;
    if (errorEl) errorEl.hidden = !error;
  }

  renderCarList() {
    const grid = document.getElementById('cars-grid');
    const countEl = document.getElementById('car-count');
    if (!grid) return;

    // Kapcsolati hiba: külön üzenet, újrapróbálkozás gombbal.
    if (this.loadError) {
      grid.innerHTML = '';
      countEl.textContent = 'A kínálat jelenleg nem érhető el';
      this.setStateVisibility({ empty: false, error: true });
      return;
    }

    const filtered = this.filterDrawer.applyFilter(this.cars);

    countEl.textContent = this.cars.length === 0
      ? 'Jelenleg nincs elérhető gépjármű'
      : `${filtered.length} elérhető gépjármű${filtered.length !== this.cars.length ? ` (összesen ${this.cars.length})` : ''}`;

    grid.innerHTML = '';

    if (filtered.length === 0) {
      this.setStateVisibility({ empty: true, error: false });
      // Ha egyáltalán nincs autó, ne szűrők módosítását javasoljuk.
      const hasNoStock = this.cars.length === 0;
      document.getElementById('empty-title').textContent = hasNoStock
        ? 'Jelenleg nincs meghirdetett gépjármű'
        : 'Nincs találat a megadott szűrők alapján';
      document.getElementById('empty-text').textContent = hasNoStock
        ? 'Készletünk folyamatosan frissül. Kérjük, nézzen vissza később, vagy hívjon minket a legfrissebb kínálatért.'
        : 'Módosítsa a keresési feltételeket a keresett jármű megtalálásához.';
      document.getElementById('btn-reset-filters').hidden = hasNoStock;
      return;
    }

    this.setStateVisibility({ empty: false, error: false });

    const fragment = document.createDocumentFragment();
    filtered.forEach(car => {
      fragment.appendChild(createCarCard(car, (selected) => this.carModal.open(selected)));
    });
    grid.appendChild(fragment);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
