import { escapeHtml } from '../utils/helpers.js';

const PRICE_STEP = 500000;
const PRICE_MIN = 1000000;
const PRICE_FALLBACK_MAX = 100000000;

function defaultState() {
  return {
    searchQuery: '',
    selectedMake: 'all',
    selectedFuel: 'all',
    maxPrice: Infinity,      // Infinity = nincs felső határ
    selectedTransmission: 'all',
    sortBy: 'newest'
  };
}

export class FilterDrawer {
  constructor(options = {}) {
    this.onFilterChange = options.onFilterChange || (() => {});
    this.state = defaultState();

    this.makes = [];
    this.fuels = ['Benzin', 'Dízel', 'Hibrid', 'Elektromos'];
    this.priceCeiling = PRICE_FALLBACK_MAX;
    this.isMobileExpanded = false;
  }

  /**
   * A szűrő lehetőségeit a tényleges készletből építjük fel.
   * Így nem fordulhat elő, hogy egy drágább autó kiesik a szűrőből.
   */
  setAvailableOptions(cars) {
    this.makes = Array.from(new Set(cars.map(c => c.make).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'hu'));

    const prices = cars.map(c => Number(c.price)).filter(p => Number.isFinite(p) && p > 0);
    const highest = prices.length > 0 ? Math.max(...prices) : PRICE_FALLBACK_MAX;

    // A csúszka teteje mindig a legdrágább autó fölött van.
    this.priceCeiling = Math.max(
      PRICE_MIN + PRICE_STEP,
      Math.ceil(highest / PRICE_STEP) * PRICE_STEP
    );

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
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              id="mobile-quick-search-input"
              class="mobile-search-input"
              placeholder="Gyors keresés (márka, típus)..."
              aria-label="Gyors keresés"
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>

          <button type="button" id="btn-toggle-mobile-accordion"
                  class="btn-toggle-accordion ${this.isMobileExpanded ? 'active' : ''}"
                  aria-expanded="${this.isMobileExpanded}" aria-controls="mobile-accordion-body">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Szűrők</span>
            ${activeFilterCount > 0 ? `<span class="filter-count-badge">${activeFilterCount}</span>` : ''}
            <svg class="chevron-icon ${this.isMobileExpanded ? 'rotated' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
    if (this.state.searchQuery.trim()) count++;
    if (this.state.selectedMake !== 'all') count++;
    if (this.state.selectedFuel !== 'all') count++;
    if (this.state.selectedTransmission !== 'all') count++;
    if (Number.isFinite(this.state.maxPrice)) count++;
    if (this.state.sortBy !== 'newest') count++;
    return count;
  }

  bindMobileAccordionEvents() {
    const toggleBtn = document.getElementById('btn-toggle-mobile-accordion');
    const quickSearchInput = document.getElementById('mobile-quick-search-input');

    toggleBtn?.addEventListener('click', () => {
      this.isMobileExpanded = !this.isMobileExpanded;

      document.getElementById('mobile-accordion-body')
        ?.classList.toggle('expanded', this.isMobileExpanded);
      toggleBtn.classList.toggle('active', this.isMobileExpanded);
      toggleBtn.setAttribute('aria-expanded', String(this.isMobileExpanded));
      toggleBtn.querySelector('.chevron-icon')?.classList.toggle('rotated', this.isMobileExpanded);
    });

    // Nincs újrarajzolás gépelés közben, hogy ne vesszen el a fókusz.
    quickSearchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      this.syncSearchInputs('mobile-quick-search-input');
      this.updateFilterBadge();
      this.emitChange();
    });
  }

  /** A három keresőmező (mobil gyors, mobil űrlap, desktop) együtt mozogjon. */
  syncSearchInputs(sourceId) {
    ['mobile-quick-search-input', 'desktop-search-input', 'mobile-search-input'].forEach(id => {
      if (id === sourceId) return;
      const el = document.getElementById(id);
      if (el && el.value !== this.state.searchQuery) el.value = this.state.searchQuery;
    });
  }

  priceLabel() {
    if (!Number.isFinite(this.state.maxPrice)) return 'Nincs felső határ';
    return `${(this.state.maxPrice / 1000000).toFixed(1).replace('.0', '')} M Ft-ig`;
  }

  getFilterFormMarkup(prefix) {
    // A csúszka legfelső állása a "nincs felső határ" - egy lépéssel a
    // legdrágább autó fölött.
    const sliderMax = this.priceCeiling + PRICE_STEP;
    const sliderValue = Number.isFinite(this.state.maxPrice) ? this.state.maxPrice : sliderMax;

    return `
      <div class="filter-panel">
        <div class="filter-header">
          <span class="filter-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Szűrés
          </span>
          <button type="button" class="btn-clear-filters" id="${prefix}-clear-btn">Alaphelyzet</button>
        </div>

        <div class="filter-group">
          <label class="filter-label" for="${prefix}-search-input">Modell vagy márka</label>
          <input type="search" id="${prefix}-search-input" class="filter-input" placeholder="pl. BMW, M4..." value="${escapeHtml(this.state.searchQuery)}" />
        </div>

        <div class="filter-group">
          <label class="filter-label" for="${prefix}-make-select">Márka</label>
          <select id="${prefix}-make-select" class="filter-select">
            <option value="all">Összes márka</option>
            ${this.makes.map(m => `<option value="${escapeHtml(m)}" ${this.state.selectedMake === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label" for="${prefix}-fuel-select">Üzemanyag</label>
          <select id="${prefix}-fuel-select" class="filter-select">
            <option value="all">Minden üzemanyag</option>
            ${this.fuels.map(f => `<option value="${escapeHtml(f)}" ${this.state.selectedFuel === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group">
          <div class="filter-label-row">
            <label class="filter-label" for="${prefix}-price-range">Max. ár</label>
            <span class="filter-value-badge" id="${prefix}-price-val">${this.priceLabel()}</span>
          </div>
          <input type="range" id="${prefix}-price-range" class="filter-range"
                 min="${PRICE_MIN}" max="${sliderMax}" step="${PRICE_STEP}" value="${sliderValue}"
                 aria-label="Maximum ár" />
        </div>

        <div class="filter-group">
          <label class="filter-label" for="${prefix}-trans-select">Váltó</label>
          <select id="${prefix}-trans-select" class="filter-select">
            <option value="all">Összes váltó típus</option>
            <option value="Automata" ${this.state.selectedTransmission === 'Automata' ? 'selected' : ''}>Automata</option>
            <option value="Manuális" ${this.state.selectedTransmission === 'Manuális' ? 'selected' : ''}>Manuális</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label" for="${prefix}-sort-select">Rendezés</label>
          <select id="${prefix}-sort-select" class="filter-select">
            <option value="newest"     ${this.state.sortBy === 'newest' ? 'selected' : ''}>Legújabb elöl</option>
            <option value="price-asc"  ${this.state.sortBy === 'price-asc' ? 'selected' : ''}>Ár szerint növekvő</option>
            <option value="price-desc" ${this.state.sortBy === 'price-desc' ? 'selected' : ''}>Ár szerint csökkenő</option>
          </select>
        </div>
      </div>
    `;
  }

  bindFilterEvents(prefix) {
    const $ = (suffix) => document.getElementById(`${prefix}-${suffix}`);

    $('search-input')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      this.syncSearchInputs(`${prefix}-search-input`);
      this.updateFilterBadge();
      this.emitChange();
    });

    $('make-select')?.addEventListener('change', (e) => {
      this.state.selectedMake = e.target.value;
      this.syncSelects('make-select', e.target.value);
      this.updateFilterBadge();
      this.emitChange();
    });

    $('fuel-select')?.addEventListener('change', (e) => {
      this.state.selectedFuel = e.target.value;
      this.syncSelects('fuel-select', e.target.value);
      this.updateFilterBadge();
      this.emitChange();
    });

    $('trans-select')?.addEventListener('change', (e) => {
      this.state.selectedTransmission = e.target.value;
      this.syncSelects('trans-select', e.target.value);
      this.updateFilterBadge();
      this.emitChange();
    });

    $('sort-select')?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.syncSelects('sort-select', e.target.value);
      this.updateFilterBadge();
      this.emitChange();
    });

    $('price-range')?.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      const sliderMax = Number(e.target.max);
      // Legfelső állás = nincs felső határ
      this.state.maxPrice = value >= sliderMax ? Infinity : value;

      ['desktop', 'mobile'].forEach(p => {
        const label = document.getElementById(`${p}-price-val`);
        if (label) label.textContent = this.priceLabel();
        const range = document.getElementById(`${p}-price-range`);
        if (range && range !== e.target) range.value = value;
      });

      this.updateFilterBadge();
      this.emitChange();
    });

    $('clear-btn')?.addEventListener('click', () => this.resetFilters());
  }

  /** A desktop és a mobil űrlap ugyanazt az állapotot mutassa. */
  syncSelects(suffix, value) {
    ['desktop', 'mobile'].forEach(p => {
      const el = document.getElementById(`${p}-${suffix}`);
      if (el && el.value !== value) el.value = value;
    });
  }

  updateFilterBadge() {
    const toggleBtn = document.getElementById('btn-toggle-mobile-accordion');
    if (!toggleBtn) return;

    const count = this.getActiveFilterCount();
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

  emitChange() {
    this.onFilterChange(this.state);
  }

  resetFilters() {
    this.state = defaultState();
    this.render();
    this.emitChange();
  }

  applyFilter(cars) {
    const query = this.state.searchQuery.trim().toLowerCase();

    return cars.filter(car => {
      if (query) {
        // A leírásban és az évjáratban is keresünk, nem csak a márkában.
        const haystack = [car.make, car.model, car.year, car.fuel, car.transmission, car.color, car.description]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (this.state.selectedMake !== 'all' && car.make !== this.state.selectedMake) return false;
      if (this.state.selectedFuel !== 'all' && car.fuel !== this.state.selectedFuel) return false;
      if (this.state.selectedTransmission !== 'all' && car.transmission !== this.state.selectedTransmission) return false;

      // Ár nélküli autó ("Ár érdeklődésre") nem esik ki az ársávból.
      const price = Number(car.price);
      if (Number.isFinite(this.state.maxPrice) && Number.isFinite(price) && price > 0) {
        if (price > this.state.maxPrice) return false;
      }

      return true;
    }).sort((a, b) => {
      if (this.state.sortBy === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (this.state.sortBy === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      return 0; // az adatbázis már created_at szerint csökkenőben adja
    });
  }
}
