import { formatCurrency, formatEngine, escapeHtml } from '../utils/helpers.js';

export function createCarCard(car, onClick) {
  const card = document.createElement('article');
  card.className = 'car-card';
  card.dataset.carId = car.id;

  const mainImage = (car.images && car.images.length > 0) 
    ? car.images[0] 
    : 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80';

  const engineText = formatEngine(car.displacement, car.power, car.fuel);

  card.innerHTML = `
    <div class="car-card-media">
      <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" class="car-card-image" loading="lazy" />
      ${car.fuel ? `<span class="car-card-badge">${escapeHtml(car.fuel)}</span>` : ''}
      ${car.year ? `<span class="car-card-year">${escapeHtml(car.year)}</span>` : ''}
    </div>
    
    <div class="car-card-body">
      <div class="car-card-header">
        <h3 class="car-card-title">${escapeHtml(car.make)} ${escapeHtml(car.model)}</h3>
        <p class="car-card-engine">${escapeHtml(engineText)}</p>
      </div>
      
      <div class="car-card-divider"></div>
      
      <div class="car-card-footer">
        <div class="car-card-price-group">
          <span class="car-card-price-label">Vételár</span>
          <span class="car-card-price">${formatCurrency(car.price)}</span>
        </div>
        
        <button class="car-card-arrow-btn" aria-label="Részletek megtekintése">
          <svg class="car-card-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    if (typeof onClick === 'function') {
      onClick(car);
    }
  });

  return card;
}
