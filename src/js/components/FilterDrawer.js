import { escapeHtml } from '../utils/helpers.js';

export class FilterDrawer {
  constructor(options = {}) {
    this.onFilterChange = options.onFilterChange || (() => {});
    this.state = {
      searchQuery: '',
      selectedMake: 'all',
      selectedFuel: 'all',
      maxPrice: 100000000,
      selectedTransmission: 'all',
      sortBy: 'newest'
    };
    
    this.makes = [];
    this.fuels = ['Benzin', 'Dízel', 'Hibrid', 'Elektromos'];
  }

  setAvailableMakes(makes) {
    this.makes = Array.from(new Set(makes)).sort();
    this.render();
  }

  render() {
    this.renderDesktopSidebar();
    this.renderMobileDrawer();
  }

  renderDesktopSidebar() {
    const container = document.getElementById('desktop-filter-container');
    if (!container) return;

    container.innerHTML = this.getFilterFormMarkup('desktop');
    this.bindFilterEvents('desktop');
  }

  renderMobileDrawer() {
    let backdrop = document.getElementById('mobile-filter-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobile-filter-backdrop';
      backdrop.className = 'drawer-backdrop';
      backdrop.innerHTML = `
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3 class="drawer-title">Szűrők</h3>
            <button class="drawer-close-btn" id="btn-close-drawer" aria-label="Bezárás">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div id="mobile-filter-content"></div>
        </div>
      `;
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop || e.target.closest('#btn-close-drawer')) {
          this.closeMobileDrawer();
        }
      });
    }

    const content = backdrop.querySelector('#mobile-filter-content');
    content.innerHTML = this.getFilterFormMarkup('mobile');
    this.bindFilterEvents('mobile');
  }

  getFilterFormMarkup(prefix) {
    return `
      <div class="filter-panel">
        <div class="filter-header">
          <span class="filter-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Keresés & Szűrés
          </span>
          <button class="btn-clear-filters" id="${prefix}-clear-btn">Alaphelyzet</button>
        </div>

        <!-- Search Input -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-search-input">Modell vagy Márka</label>
          <input type="text" id="${prefix}-search-input" class="filter-input" placeholder="pl. BMW, GT 63..." value="${escapeHtml(this.state.searchQuery)}" />
        </div>

        <!-- Make Select -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-make-select">Márka</label>
          <select id="${prefix}-make-select" class="filter-select">
            <option value="all">Összes márka</option>
            ${this.makes.map(m => `<option value="${escapeHtml(m)}" ${this.state.selectedMake === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
          </select>
        </div>

        <!-- Fuel Select -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-fuel-select">Üzemanyag</label>
          <select id="${prefix}-fuel-select" class="filter-select">
            <option value="all">Minden üzemanyag</option>
            ${this.fuels.map(f => `<option value="${escapeHtml(f)}" ${this.state.selectedFuel === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
          </select>
        </div>

        <!-- Maximum Price Slider -->
        <div class="filter-group">
          <div style="display:flex; justify-between; align-items:center; margin-bottom:8px;">
            <label class="filter-label" style="margin:0;">Max. Ár</label>
            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);" id="${prefix}-price-val">
              ${(this.state.maxPrice / 1000000).toFixed(0)} M Ft
            </span>
          </div>
          <input type="range" id="${prefix}-price-range" min="10000000" max="100000000" step="2000000" value="${this.state.maxPrice}" style="width:100%; accent-color: var(--accent-dark); cursor:pointer;" />
        </div>

        <!-- Transmission Select -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-trans-select">Váltó</label>
          <select id="${prefix}-trans-select" class="filter-select">
            <option value="all">Összes váltó típus</option>
            <option value="Automata" ${this.state.selectedTransmission === 'Automata' ? 'selected' : ''}>Automata</option>
            <option value="Manuális" ${this.state.selectedTransmission === 'Manuális' ? 'selected' : ''}>Manuális</option>
          </select>
        </div>

        <!-- Sort By -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-sort-select">Rendezés</label>
          <select id="${prefix}-sort-select" class="filter-select">
            <option value="newest" ${this.state.sortBy === 'newest' ? 'selected' : ''}>Legújabb elöl</option>
            <option value="price-asc" ${this.state.sortBy === 'price-asc' ? 'selected' : ''}>Ár szerint növekvő</option>
            <option value="price-desc" ${this.state.sortBy === 'price-desc' ? 'selected' : ''}>Ár szerint csökkenő</option>
          </select>
        </div>
      </div>
    `;
  }

  bindFilterEvents(prefix) {
    const searchInput = document.getElementById(`${prefix}-search-input`);
    const makeSelect = document.getElementById(`${prefix}-make-select`);
    const fuelSelect = document.getElementById(`${prefix}-fuel-select`);
    const priceRange = document.getElementById(`${prefix}-price-range`);
    const transSelect = document.getElementById(`${prefix}-trans-select`);
    const sortSelect = document.getElementById(`${prefix}-sort-select`);
    const clearBtn = document.getElementById(`${prefix}-clear-btn`);

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.emitChange();
      });
    }

    if (makeSelect) {
      makeSelect.addEventListener('change', (e) => {
        this.state.selectedMake = e.target.value;
        this.emitChange();
      });
    }

    if (fuelSelect) {
      fuelSelect.addEventListener('change', (e) => {
        this.state.selectedFuel = e.target.value;
        this.emitChange();
      });
    }

    if (priceRange) {
      priceRange.addEventListener('input', (e) => {
        this.state.maxPrice = Number(e.target.value);
        const valDisplay = document.getElementById(`${prefix}-price-val`);
        if (valDisplay) valDisplay.textContent = `${(this.state.maxPrice / 1000000).toFixed(0)} M Ft`;
        this.emitChange();
      });
    }

    if (transSelect) {
      transSelect.addEventListener('change', (e) => {
        this.state.selectedTransmission = e.target.value;
        this.emitChange();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.emitChange();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }
  }

  emitChange() {
    this.onFilterChange(this.state);
  }

  resetFilters() {
    this.state = {
      searchQuery: '',
      selectedMake: 'all',
      selectedFuel: 'all',
      maxPrice: 100000000,
      selectedTransmission: 'all',
      sortBy: 'newest'
    };
    this.render();
    this.emitChange();
  }

  openMobileDrawer() {
    const backdrop = document.getElementById('mobile-filter-backdrop');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeMobileDrawer() {
    const backdrop = document.getElementById('mobile-filter-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  applyFilter(cars) {
    return cars.filter(car => {
      // Search text
      if (this.state.searchQuery) {
        const query = this.state.searchQuery.toLowerCase();
        const title = `${car.make} ${car.model}`.toLowerCase();
        if (!title.includes(query)) return false;
      }

      // Make
      if (this.state.selectedMake !== 'all' && car.make !== this.state.selectedMake) {
        return false;
      }

      // Fuel
      if (this.state.selectedFuel !== 'all' && car.fuel !== this.state.selectedFuel) {
        return false;
      }

      // Transmission
      if (this.state.selectedTransmission !== 'all' && car.transmission !== this.state.selectedTransmission) {
        return false;
      }

      // Price
      if (car.price && car.price > this.state.maxPrice) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (this.state.sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (this.state.sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
      return 0; // default order
    });
  }
}
