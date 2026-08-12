import { formatCurrency, formatMileage, escapeHtml, safeImageUrl, showToast, trapFocus } from '../utils/helpers.js';
import { dbService } from '../db.js';
import { CONTACT, phoneHref, phoneDisplay } from '../config.js';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85';

export class CarModal {
  constructor(options = {}) {
    this.onOpen = options.onOpen || (() => {});
    this.onClose = options.onClose || (() => {});

    this.overlay = null;
    this.currentCar = null;
    this.currentImages = [];
    this.currentIndex = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.releaseFocusTrap = null;
    this.previouslyFocused = null;

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
        <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-car-title-el">
          <button class="modal-close-btn" id="modal-close-trigger" aria-label="Bezárás">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="modal-grid" id="modal-content-target"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.overlay = overlay;
  }

  isOpen() {
    return this.overlay.classList.contains('active');
  }

  bindEvents() {
    this.overlay.querySelector('#modal-close-trigger')
      .addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;
      // Ha az űrlapba gépel, a nyilak ne lapozzanak galériát.
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (e.key === 'Escape') this.close();
      if (!typing && e.key === 'ArrowLeft') this.prevImage();
      if (!typing && e.key === 'ArrowRight') this.nextImage();
    });
  }

  open(car) {
    this.currentCar = car;
    this.previouslyFocused = document.activeElement;

    const validImages = (car.images || []).map(safeImageUrl).filter(Boolean);
    this.currentImages = validImages.length > 0 ? validImages : [PLACEHOLDER_IMAGE];
    this.currentIndex = 0;

    const target = this.overlay.querySelector('#modal-content-target');
    const title = `${car.make || ''} ${car.model || ''}`.trim() || 'Gépjármű';
    const multiple = this.currentImages.length > 1;

    target.innerHTML = `
      <div class="modal-gallery">
        <div class="gallery-main" id="gallery-main-box">
          ${multiple ? `<span class="gallery-counter" id="gallery-counter-badge">1 / ${this.currentImages.length}</span>` : ''}

          <img id="gallery-active-img" src="${this.currentImages[0]}" alt="${escapeHtml(title)}" class="gallery-main-img" />

          ${multiple ? `
            <button type="button" class="gallery-nav-btn gallery-nav-prev" id="gallery-prev-btn" aria-label="Előző fotó">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button type="button" class="gallery-nav-btn gallery-nav-next" id="gallery-next-btn" aria-label="Következő fotó">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ` : ''}
        </div>

        ${multiple ? `
          <div class="gallery-thumbnails" id="gallery-thumbs-row">
            ${this.currentImages.map((img, idx) => `
              <button type="button" class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="${idx + 1}. fotó megjelenítése">
                <img src="${img}" alt="" loading="lazy" />
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="modal-details">
        <div class="modal-header-info">
          ${car.make ? `<span class="modal-car-make">${escapeHtml(car.make)}</span>` : ''}
          <h2 class="modal-car-title" id="modal-car-title-el">${escapeHtml(car.model || title)}</h2>
          <div class="modal-price-tag">${escapeHtml(formatCurrency(car.price))}</div>
        </div>

        <div class="specs-grid">
          ${this.specBox('Évjárat', car.year)}
          ${this.specBox('Futásteljesítmény', formatMileage(car.mileage))}
          ${this.specBox('Műszaki érvényessége', car.inspection_validity)}
          ${this.specBox('Hengerűrtartalom', car.displacement ? car.displacement.toLocaleString('hu-HU') + ' cm³' : null)}
          ${this.specBox('Teljesítmény', car.power ? car.power + ' LE' : null)}
          ${this.specBox('Üzemanyag', car.fuel)}
          ${this.specBox('Váltó', car.transmission)}
          ${this.specBox('Szín', car.color)}
          ${this.specBox('Állapot', car.condition)}
        </div>

        ${car.description ? `
          <h3 class="modal-description-title">Jármű leírása</h3>
          <p class="modal-description-text">${escapeHtml(car.description)}</p>
        ` : ''}

        <div class="modal-actions">
          ${CONTACT.phone ? `
            <a href="${escapeHtml(phoneHref())}" class="modal-cta-btn modal-cta-primary">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              ${escapeHtml(phoneDisplay())}
            </a>
          ` : ''}

          <button type="button" class="modal-cta-btn modal-cta-secondary" id="btn-toggle-inquiry">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Visszahívást kérek
          </button>

          <button type="button" class="modal-share-btn" id="btn-share-car" aria-label="Hirdetés megosztása">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            <span>Megosztás</span>
          </button>
        </div>

        <form class="inquiry-form" id="inquiry-form" hidden>
          <p class="inquiry-form-intro">Megadott elérhetőségén értékesítőnk felveszi Önnel a kapcsolatot.</p>
          <div class="inquiry-form-row">
            <div>
              <label class="form-label" for="inq-name">Név *</label>
              <input type="text" id="inq-name" class="form-input" required autocomplete="name" maxlength="80" />
            </div>
            <div>
              <label class="form-label" for="inq-phone">Telefonszám *</label>
              <input type="tel" id="inq-phone" class="form-input" required autocomplete="tel" maxlength="30" placeholder="+36 30 123 4567" />
            </div>
          </div>
          <div>
            <label class="form-label" for="inq-message">Üzenet</label>
            <textarea id="inq-message" class="form-textarea" rows="2" maxlength="600" placeholder="Pl. mikor tudná megnézni a járművet?"></textarea>
          </div>
          <button type="submit" class="modal-cta-btn modal-cta-primary" id="inquiry-submit-btn">Érdeklődés elküldése</button>
          <p class="inquiry-form-privacy">
            Az elküldéssel elfogadja az <a href="./adatkezeles.html" target="_blank" rel="noopener">adatkezelési tájékoztatót</a>.
          </p>
        </form>
      </div>
    `;

    this.bindGalleryControls(target);
    this.bindActions(target, car, title);

    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const container = this.overlay.querySelector('.modal-container');
    container.scrollTop = 0;
    this.releaseFocusTrap = trapFocus(container);
    setTimeout(() => this.overlay.querySelector('#modal-close-trigger')?.focus(), 60);

    this.onOpen(car);
  }

  specBox(label, value) {
    const display = (value === null || value === undefined || value === '') ? '-' : value;
    return `
      <div class="spec-box">
        <span class="spec-label">${escapeHtml(label)}</span>
        <span class="spec-value">${escapeHtml(display)}</span>
      </div>
    `;
  }

  bindGalleryControls(target) {
    target.querySelector('#gallery-prev-btn')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this.prevImage(); });
    target.querySelector('#gallery-next-btn')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this.nextImage(); });

    target.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => this.setImageIndex(Number(thumb.dataset.idx)));
    });

    const activeImg = target.querySelector('#gallery-active-img');
    activeImg?.addEventListener('error', () => {
      if (activeImg.src !== PLACEHOLDER_IMAGE) activeImg.src = PLACEHOLDER_IMAGE;
    });

    // Érintéses lapozás - csak vízszintes mozdulatra, hogy a függőleges
    // görgetést ne akassza meg.
    const mainBox = target.querySelector('#gallery-main-box');
    if (mainBox) {
      mainBox.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      mainBox.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - this.touchStartX;
        const dy = e.changedTouches[0].screenY - this.touchStartY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          dx < 0 ? this.nextImage() : this.prevImage();
        }
      }, { passive: true });
    }
  }

  bindActions(target, car, title) {
    // Megosztás: közvetlen link erre az autóra
    target.querySelector('#btn-share-car')?.addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}#auto/${encodeURIComponent(car.id)}`;
      const shareData = { title: `${title} - MOZSÓ Bizományos Autók`, url };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(url);
          showToast('A hirdetés linkje a vágólapra másolva.', 'success');
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          showToast('A megosztás nem sikerült.', 'error');
        }
      }
    });

    // Érdeklődési űrlap ki/be
    const toggleBtn = target.querySelector('#btn-toggle-inquiry');
    const form = target.querySelector('#inquiry-form');

    toggleBtn?.addEventListener('click', () => {
      form.hidden = !form.hidden;
      toggleBtn.classList.toggle('active', !form.hidden);
      if (!form.hidden) {
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => target.querySelector('#inq-name')?.focus(), 200);
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = target.querySelector('#inquiry-submit-btn');
      const name = target.querySelector('#inq-name').value.trim();
      const phone = target.querySelector('#inq-phone').value.trim();
      const message = target.querySelector('#inq-message').value.trim();

      if (name.length < 2) {
        showToast('Kérjük, adja meg a nevét.', 'error');
        return;
      }
      if (phone.replace(/\D/g, '').length < 9) {
        showToast('Kérjük, adjon meg egy érvényes telefonszámot.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Küldés folyamatban...';

      try {
        await dbService.submitInquiry({
          car_id: car.id,
          car_label: title,
          name,
          phone,
          message: message || null
        });

        form.innerHTML = `
          <div class="inquiry-success">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div>
              <strong>Köszönjük, megkaptuk az érdeklődését!</strong>
              <span>Értékesítőnk hamarosan keresi a megadott számon.</span>
            </div>
          </div>
        `;
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Érdeklődés elküldése';
      }
    });
  }

  setImageIndex(index) {
    if (this.currentImages.length === 0) return;

    if (index < 0) index = this.currentImages.length - 1;
    if (index >= this.currentImages.length) index = 0;
    this.currentIndex = index;

    const activeImg = this.overlay.querySelector('#gallery-active-img');
    if (activeImg) activeImg.src = this.currentImages[index];

    const badge = this.overlay.querySelector('#gallery-counter-badge');
    if (badge) badge.textContent = `${index + 1} / ${this.currentImages.length}`;

    this.overlay.querySelectorAll('.gallery-thumb').forEach(t => {
      t.classList.toggle('active', Number(t.dataset.idx) === index);
    });
  }

  prevImage() { this.setImageIndex(this.currentIndex - 1); }
  nextImage() { this.setImageIndex(this.currentIndex + 1); }

  close() {
    if (!this.isOpen()) return;

    this.overlay.classList.remove('active');
    document.body.style.overflow = '';

    if (this.releaseFocusTrap) {
      this.releaseFocusTrap();
      this.releaseFocusTrap = null;
    }

    // A fókusz oda kerüljön vissza, ahonnan indult.
    if (this.previouslyFocused?.focus) this.previouslyFocused.focus();

    const closedCar = this.currentCar;
    this.currentCar = null;
    this.onClose(closedCar);
  }
}
