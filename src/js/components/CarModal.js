import { formatCurrency, formatMileage, escapeHtml, showToast } from '../utils/helpers.js';

export class CarModal {
  constructor() {
    this.overlay = null;
    this.createModalMarkup();
    this.bindEvents();
  }

  createModalMarkup() {
    let overlay = document.getElementById('car-detail-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'car-detail-modal';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-container">
          <button class="modal-close-btn" id="modal-close-trigger" aria-label="Bezárás">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div class="modal-grid" id="modal-content-target">
            <!-- Dynamic content injected here -->
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.overlay = overlay;
  }

  bindEvents() {
    const closeBtn = this.overlay.querySelector('#modal-close-trigger');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });
  }

  open(car) {
    const target = this.overlay.querySelector('#modal-content-target');
    const images = (car.images && car.images.length > 0) 
      ? car.images 
      : ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85'];

    target.innerHTML = `
      <div class="modal-gallery">
        <div class="gallery-main">
          <img id="gallery-active-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" class="gallery-main-img" />
        </div>
        ${images.length > 1 ? `
          <div class="gallery-thumbnails">
            ${images.map((img, idx) => `
              <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-img-url="${escapeHtml(img)}">
                <img src="${escapeHtml(img)}" alt="Kép ${idx + 1}" />
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="modal-details">
        <div class="modal-header-info">
          <span class="modal-car-make">${escapeHtml(car.make)}</span>
          <h2 class="modal-car-title">${escapeHtml(car.model)}</h2>
          <div class="modal-price-tag">${formatCurrency(car.price)}</div>
        </div>

        <div class="specs-grid">
          <div class="spec-box">
            <span class="spec-label">Évjárat</span>
            <span class="spec-value">${car.year || '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Futásteljesítmény</span>
            <span class="spec-value">${formatMileage(car.mileage)}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Hengerűrtartalom</span>
            <span class="spec-value">${car.displacement ? car.displacement.toLocaleString('hu-HU') + ' cm³' : '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Teljesítmény</span>
            <span class="spec-value">${car.power ? car.power + ' LE' : '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Üzemanyag</span>
            <span class="spec-value">${car.fuel || '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Váltó</span>
            <span class="spec-value">${car.transmission || '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Szín</span>
            <span class="spec-value">${car.color || '-'}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Állapot</span>
            <span class="spec-value">${car.condition || 'Kitűnő'}</span>
          </div>
        </div>

        ${car.description ? `
          <h4 class="modal-description-title">Jármű leírása</h4>
          <p class="modal-description-text">${escapeHtml(car.description)}</p>
        ` : ''}

        <button class="modal-cta-btn" id="btn-inquire-car">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          Érdeklődés erről a modellről
        </button>
      </div>
    `;

    // Bind thumbnail click events
    const thumbs = target.querySelectorAll('.gallery-thumb');
    const activeImg = target.querySelector('#gallery-active-img');

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        activeImg.src = thumb.dataset.imgUrl;
      });
    });

    // Inquiry CTA handler
    const ctaBtn = target.querySelector('#btn-inquire-car');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        showToast(`Érdeklődés regisztrálva a(z) ${car.make} ${car.model} modellre! Értékesítőnk hamarosan keresi.`, 'success');
      });
    }

    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}
