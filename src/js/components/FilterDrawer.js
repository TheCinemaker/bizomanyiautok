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
    this.isMobileExpanded = false;
  }

  setAvailableMakes(makes) {
    this.makes = Array.from(new Set(makes)).sort();
    this.render();
  }

  render() {
    this.renderDesktopSidebar();
    this.renderMobileAccordion();
  }

  renderDesktopSidebar() {
    const container = document.getElementById('desktop-filter-container');
    if (!container) return;

    container.innerHTML = this.getFilterFormMarkup('desktop');
    this.bindFilterEvents('desktop');
  }

  renderMobileAccordion() {
    const container = document.getElementById('mobile-filter-container');
    if (!container) return;

    const activeFilterCount = this.getActiveFilterCount();

    container.innerHTML = `
      <div class="mobile-filter-wrapper">
        <div class="mobile-filter-header-bar">
          <div class="mobile-search-box">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              id="mobile-quick-search-input" 
              class="mobile-search-input" 
              placeholder="Gyors keresés (márka, típus)..." 
              value="${escapeHtml(this.state.searchQuery)}"
            />
            ${this.state.searchQuery ? `<button id="mobile-clear-search" class="clear-search-btn">&times;</button>` : ''}
          </div>

          <button id="btn-toggle-mobile-accordion" class="btn-toggle-accordion ${this.isMobileExpanded ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Szűrők</span>
            ${activeFilterCount > 0 ? `<span class="filter-count-badge">${activeFilterCount}</span>` : ''}
            <svg class="chevron-icon ${this.isMobileExpanded ? 'rotated' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
        </div>

        <div id="mobile-accordion-body" class="mobile-accordion-body ${this.isMobileExpanded ? 'expanded' : ''}">
          <div class="mobile-accordion-inner">
            ${this.getFilterFormMarkup('mobile')}
          </div>
        </div>
      </div>
    `;

    this.bindMobileAccordionEvents();
    this.bindFilterEvents('mobile');
  }

  getActiveFilterCount() {
    let count = 0;
    if (this.state.selectedMake !== 'all') count++;
    if (this.state.selectedFuel !== 'all') count++;
    if (this.state.selectedTransmission !== 'all') count++;
    if (this.state.maxPrice < 100000000) count++;
    if (this.state.sortBy !== 'newest') count++;
    return count;
  }

  bindMobileAccordionEvents() {
    const toggleBtn = document.getElementById('btn-toggle-mobile-accordion');
    const headerBtnMobile = document.getElementById('btn-mobile-filter');
    const quickSearchInput = document.getElementById('mobile-quick-search-input');
    const clearSearchBtn = document.getElementById('mobile-clear-search');

    const toggleFn = () => {
      this.isMobileExpanded = !this.isMobileExpanded;
      const accordionBody = document.getElementById('mobile-accordion-body');
      const chevron = toggleBtn ? toggleBtn.querySelector('.chevron-icon') : null;

      if (toggleBtn) toggleBtn.classList.toggle('active', this.isMobileExpanded);
      if (accordionBody) accordionBody.classList.toggle('expanded', this.isMobileExpanded);
      if (chevron) chevron.classList.toggle('rotated', this.isMobileExpanded);
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleFn);
    }

    if (headerBtnMobile) {
      headerBtnMobile.onclick = () => {
        if (!this.isMobileExpanded) {
          toggleFn();
        }
        const mobileContainer = document.getElementById('mobile-filter-container');
        if (mobileContainer) {
          mobileContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
    }

    if (quickSearchInput) {
      quickSearchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        const desktopSearch = document.getElementById('desktop-search-input');
        if (desktopSearch) desktopSearch.value = this.state.searchQuery;
        const mobileFormSearch = document.getElementById('mobile-search-input');
        if (mobileFormSearch) mobileFormSearch.value = this.state.searchQuery;
        this.emitChange();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.state.searchQuery = '';
        this.render();
        this.emitChange();
      });
    }
  }

  getFilterFormMarkup(prefix) {
    return `
      <div class="filter-panel">
        <div class="filter-header">
          <span class="filter-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Részletes Szűrés
          </span>
          <button class="btn-clear-filters" id="${prefix}-clear-btn">Alaphelyzet</button>
        </div>

        <!-- Search Input -->
        <div class="filter-group">
          <label class="filter-label" for="${prefix}-search-input">Modell vagy Márka</label>
          <input type="text" id="${prefix}-search-input" class="filter-input" placeholder="pl. BMW, M4..." value="${escapeHtml(this.state.searchQuery)}" />
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="filter-label" style="margin:0;">Max. Ár</label>
            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);" id="${prefix}-price-val">
              ${(this.state.maxPrice / 1000000).toFixed(0)} M Ft
            </span>
          </div>
          <input type="range" id="${prefix}-price-range" min="5000000" max="100000000" step="1000000" value="${this.state.maxPrice}" style="width:100%; accent-color: var(--accent-dark); cursor:pointer;" />
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
        const otherSearch = document.getElementById(prefix === 'desktop' ? 'mobile-quick-search-input' : 'desktop-search-input');
        if (otherSearch) otherSearch.value = this.state.searchQuery;
        this.emitChange();
      });
    }

    if (makeSelect) {
      makeSelect.addEventListener('change', (e) => {
        this.state.selectedMake = e.target.value;
        this.updateFilterBadge();
        this.emitChange();
      });
    }

    if (fuelSelect) {
      fuelSelect.addEventListener('change', (e) => {
        this.state.selectedFuel = e.target.value;
        this.updateFilterBadge();
        this.emitChange();
      });
    }

    if (priceRange) {
      priceRange.addEventListener('input', (e) => {
        this.state.maxPrice = Number(e.target.value);
        const valDisplay = document.getElementById(`${prefix}-price-val`);
        if (valDisplay) valDisplay.textContent = `${(this.state.maxPrice / 1000000).toFixed(0)} M Ft`;
        this.updateFilterBadge();
        this.emitChange();
      });
    }

    if (transSelect) {
      transSelect.addEventListener('change', (e) => {
        this.state.selectedTransmission = e.target.value;
        this.updateFilterBadge();
        this.emitChange();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.updateFilterBadge();
        this.emitChange();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }
  }

  updateFilterBadge() {
    const toggleBtn = document.getElementById('btn-toggle-mobile-accordion');
    const count = this.getActiveFilterCount();

    if (toggleBtn) {
      let badge = toggleBtn.querySelector('.filter-count-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'filter-count-badge';
          toggleBtn.insertBefore(badge, toggleBtn.querySelector('.chevron-icon'));
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
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
    this.isMobileExpanded = true;
    this.renderMobileAccordion();
    const mobileContainer = document.getElementById('mobile-filter-container');
    if (mobileContainer) {
      mobileContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

