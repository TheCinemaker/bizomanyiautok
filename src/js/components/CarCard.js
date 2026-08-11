import { formatCurrency, formatEngine, formatMileage, escapeHtml, safeImageUrl } from '../utils/helpers.js';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80';

export function createCarCard(car, onClick) {
  const card = document.createElement('article');
  card.className = 'car-card';
  card.dataset.carId = car.id;

  // Billentyűzettel is elérhető legyen: a kártya maga a gomb.
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const title = `${car.make || ''} ${car.model || ''}`.trim() || 'Gépjármű';
  card.setAttribute('aria-label', `${title} részleteinek megtekintése`);

  const mainImage = safeImageUrl(car.images?.[0]) || PLACEHOLDER_IMAGE;
  const engineText = formatEngine(car.displacement, car.power, car.fuel);

  // Csak a ténylegesen kitöltött adatok kapjanak címkét - egy "-" vagy
  // "0 km" felirat rosszabb, mintha ott sem lenne.
  const metaItems = [];
  if (Number(car.mileage) > 0) metaItems.push(formatMileage(car.mileage));
  if (car.transmission) metaItems.push(car.transmission);

  card.innerHTML = `
    <div class="car-card-media">
      <img src="${mainImage}" alt="${escapeHtml(title)}" class="car-card-image" loading="lazy" decoding="async" />
      ${car.fuel ? `<span class="car-card-badge">${escapeHtml(car.fuel)}</span>` : ''}
      ${car.year ? `<span class="car-card-year">${escapeHtml(car.year)}</span>` : ''}
    </div>

    <div class="car-card-body">
      <div class="car-card-header">
        <h3 class="car-card-title">${escapeHtml(title)}</h3>
        <p class="car-card-engine">${escapeHtml(engineText)}</p>
      </div>

      ${metaItems.length > 0 ? `
        <div class="car-card-meta">
          ${metaItems.map(item => `<span class="car-card-meta-item">${escapeHtml(item)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="car-card-divider"></div>

      <div class="car-card-footer">
        <div class="car-card-price-group">
          <span class="car-card-price-label">Vételár</span>
          <span class="car-card-price">${escapeHtml(formatCurrency(car.price))}</span>
        </div>

        <span class="car-card-arrow-btn" aria-hidden="true">
          <svg class="car-card-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </span>
      </div>
    </div>
  `;

  // Hiányzó vagy törölt kép esetén ne maradjon üres doboz.
  const imgEl = card.querySelector('.car-card-image');
  imgEl.addEventListener('error', () => {
    if (imgEl.src !== PLACEHOLDER_IMAGE) imgEl.src = PLACEHOLDER_IMAGE;
  }, { once: true });

  const activate = () => {
    if (typeof onClick === 'function') onClick(car);
  };

  card.addEventListener('click', activate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });

  return card;
}
