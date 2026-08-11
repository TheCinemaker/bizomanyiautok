import { formatCurrency, formatMileage, escapeHtml, showToast } from '../utils/helpers.js';

export class CarModal {
  constructor() {
    this.overlay = null;
    this.currentImages = [];
    this.currentIndex = 0;
    this.touchStartX = 0;
    this.touchEndX = 0;
    
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
      if (!this.overlay.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prevImage();
      if (e.key === 'ArrowRight') this.nextImage();
    });
  }

  open(car) {
    this.currentImages = (car.images && car.images.length > 0) 
      ? car.images 
      : ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85'];
    this.currentIndex = 0;

    const target = this.overlay.querySelector('#modal-content-target');

    target.innerHTML = `
      <div class="modal-gallery">
        <div class="gallery-main" id="gallery-main-box">
          <!-- Counter badge -->
          <span class="gallery-counter" id="gallery-counter-badge">1 / ${this.currentImages.length}</span>
          
          <!-- Main Image -->
          <img id="gallery-active-img" src="${escapeHtml(this.currentImages[0])}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" class="gallery-main-img" />
          
          <!-- Prev/Next Navigation Circle Buttons (Always Visible) -->
          ${this.currentImages.length > 1 ? `
            <button class="gallery-nav-btn gallery-nav-prev" id="gallery-prev-btn" aria-label="Előző fotó">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="gallery-nav-btn gallery-nav-next" id="gallery-next-btn" aria-label="Következő fotó">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ` : ''}
        </div>

        <!-- Thumbnails row -->
        ${this.currentImages.length > 1 ? `
          <div class="gallery-thumbnails" id="gallery-thumbs-row">
            ${this.currentImages.map((img, idx) => `
              <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                <img src="${escapeHtml(img)}" alt="Bélyegkép ${idx + 1}" />
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

    // Bind gallery controls
    const prevBtn = target.querySelector('#gallery-prev-btn');
    const nextBtn = target.querySelector('#gallery-next-btn');

    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prevImage(); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.nextImage(); });

    // Thumbnails click
    const thumbs = target.querySelectorAll('.gallery-thumb');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const idx = Number(thumb.dataset.idx);
        this.setImageIndex(idx);
      });
    });

    // Touch swipe support for mobile devices
    const mainBox = target.querySelector('#gallery-main-box');
    if (mainBox) {
      mainBox.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      mainBox.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });
    }

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

  handleSwipe() {
    const diffX = this.touchEndX - this.touchStartX;
    if (Math.abs(diffX) > 40) {
      if (diffX < 0) {
        this.nextImage();
      } else {
        this.prevImage();
      }
    }
  }

  setImageIndex(index) {
    if (this.currentImages.length === 0) return;
    if (index < 0) index = this.currentImages.length - 1;
    if (index >= this.currentImages.length) index = 0;

    this.currentIndex = index;
    const activeImg = this.overlay.querySelector('#gallery-active-img');
    const badge = this.overlay.querySelector('#gallery-counter-badge');
    const thumbs = this.overlay.querySelectorAll('.gallery-thumb');

    if (activeImg) {
      activeImg.src = this.currentImages[this.currentIndex];
    }

    if (badge) {
      badge.textContent = `${this.currentIndex + 1} / ${this.currentImages.length}`;
    }

    thumbs.forEach(t => {
      const idx = Number(t.dataset.idx);
      t.classList.toggle('active', idx === this.currentIndex);
    });
  }

  prevImage() {
    this.setImageIndex(this.currentIndex - 1);
  }

  nextImage() {
    this.setImageIndex(this.currentIndex + 1);
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}
