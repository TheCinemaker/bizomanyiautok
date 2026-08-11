import { dbService } from './db.js';
import { createCarCard } from './components/CarCard.js';
import { CarModal } from './components/CarModal.js';
import { FilterDrawer } from './components/FilterDrawer.js';
import { AdminPanel } from './components/AdminPanel.js';

class App {
  constructor() {
    this.cars = [];
    this.carModal = new CarModal();
    this.filterDrawer = new FilterDrawer({
      onFilterChange: (filterState) => this.handleFilterChange(filterState)
    });
    
    this.adminPanel = new AdminPanel({
      onCarsUpdated: () => this.loadAndRenderCars()
    });

    this.init();
  }

  async init() {
    this.bindGlobalEvents();
    await this.loadAndRenderCars();
  }

  bindGlobalEvents() {
    // Mobile hamburger menu filter toggler
    const mobileFilterBtn = document.getElementById('btn-mobile-filter');
    if (mobileFilterBtn) {
      mobileFilterBtn.addEventListener('click', () => {
        this.filterDrawer.openMobileDrawer();
      });
    }

    // Reset filters button in empty state
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.filterDrawer.resetFilters();
      });
    }
  }

  async loadAndRenderCars() {
    const carsGrid = document.getElementById('cars-grid');
    const carCountEl = document.getElementById('car-count');
    const emptyState = document.getElementById('empty-state');

    this.cars = await dbService.getCars();

    // Populate unique makes for filter
    const makes = this.cars.map(c => c.make).filter(Boolean);
    this.filterDrawer.setAvailableMakes(makes);

    // Initial render based on active filters
    this.renderCarList();
  }

  renderCarList() {
    const carsGrid = document.getElementById('cars-grid');
    const carCountEl = document.getElementById('car-count');
    const emptyState = document.getElementById('empty-state');

    if (!carsGrid) return;

    const filteredCars = this.filterDrawer.applyFilter(this.cars);

    if (carCountEl) {
      carCountEl.textContent = `${filteredCars.length} darab elérhető modell`;
    }

    carsGrid.innerHTML = '';

    if (filteredCars.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    filteredCars.forEach(car => {
      const cardEl = createCarCard(car, (selectedCar) => {
        this.carModal.open(selectedCar);
      });
      carsGrid.appendChild(cardEl);
    });
  }

  handleFilterChange() {
    this.renderCarList();
  }
}

// Initialize application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
