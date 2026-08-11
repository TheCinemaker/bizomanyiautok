import { dbService } from '../db.js';
import { fileToBase64, showToast, escapeHtml, formatCurrency } from '../utils/helpers.js';

export class AdminPanel {
  constructor(options = {}) {
    this.onCarsUpdated = options.onCarsUpdated || (() => {});
    this.isAuthorized = false;
    this.pinCode = '1234';
    this.uploadedImages = [];
    
    this.createPinModal();
    this.createAdminModal();
    this.setupLongPressTrigger();
  }

  setupLongPressTrigger() {
    const logoEl = document.getElementById('brand-logo-trigger');
    if (!logoEl) return;

    let pressTimer = null;

    const startPress = (e) => {
      logoEl.classList.add('holding-admin');

      pressTimer = setTimeout(() => {
        logoEl.classList.remove('holding-admin');
        showToast('Admin azonosítás...', 'info');
        this.openPinModal();
      }, 5000);
    };

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      logoEl.classList.remove('holding-admin');
    };

    logoEl.addEventListener('click', (e) => e.preventDefault());

    logoEl.addEventListener('mousedown', startPress);
    logoEl.addEventListener('mouseup', cancelPress);
    logoEl.addEventListener('mouseleave', cancelPress);

    logoEl.addEventListener('touchstart', startPress, { passive: true });
    logoEl.addEventListener('touchend', cancelPress);
    logoEl.addEventListener('touchcancel', cancelPress);
  }

  createPinModal() {
    let pinOverlay = document.getElementById('admin-pin-modal');
    if (!pinOverlay) {
      pinOverlay = document.createElement('div');
      pinOverlay.id = 'admin-pin-modal';
      pinOverlay.className = 'pin-modal-overlay';
      pinOverlay.innerHTML = `
        <div class="pin-modal">
          <div class="pin-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 class="pin-title">Adminisztrátori Belépés</h3>
          <p class="pin-subtitle">Adja meg a 4 jegyű PIN kódot (Alapértelmezett: 1234)</p>
          <form id="pin-form">
            <div class="pin-input-group">
              <input type="password" id="pin-code-input" class="pin-input" maxlength="4" placeholder="••••" required autofocus />
            </div>
            <button type="submit" class="pin-submit-btn">Belépés</button>
          </form>
        </div>
      `;
      document.body.appendChild(pinOverlay);

      pinOverlay.addEventListener('click', (e) => {
        if (e.target === pinOverlay) {
          this.closePinModal();
        }
      });

      const form = pinOverlay.querySelector('#pin-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = pinOverlay.querySelector('#pin-code-input');
        if (input.value === this.pinCode) {
          this.isAuthorized = true;
          this.closePinModal();
          this.openAdminModal();
          showToast('Sikeres azonosítás!', 'success');
        } else {
          showToast('Helytelen PIN kód!', 'error');
          input.value = '';
          input.focus();
        }
      });
    }
  }

  openPinModal() {
    if (this.isAuthorized) {
      this.openAdminModal();
      return;
    }
    const pinOverlay = document.getElementById('admin-pin-modal');
    if (pinOverlay) {
      pinOverlay.classList.add('active');
      const input = pinOverlay.querySelector('#pin-code-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
    }
  }

  closePinModal() {
    const pinOverlay = document.getElementById('admin-pin-modal');
    if (pinOverlay) pinOverlay.classList.remove('active');
  }

  createAdminModal() {
    let overlay = document.getElementById('admin-dashboard-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'admin-dashboard-modal';
      overlay.className = 'admin-modal-overlay';
      overlay.innerHTML = `
        <div class="admin-container">
          <div class="admin-header">
            <div class="admin-title-wrap">
              <span class="admin-badge">Adminisztráció</span>
              <h2 class="admin-title">Készletkezelő Felület</h2>
            </div>
            <button class="modal-close-btn" id="admin-close-btn" style="position:static;" aria-label="Bezárás">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="admin-tabs">
            <button class="admin-tab-btn active" data-tab="tab-add-car">Új autó feltöltése</button>
            <button class="admin-tab-btn" data-tab="tab-manage-cars">Készlet törlése / Kezelése</button>
          </div>

          <div class="admin-body">
            <!-- TAB 1: ADD CAR -->
            <div id="tab-add-car" class="admin-tab-content active">
              <form id="add-car-form">
                <div class="form-grid">
                  <div>
                    <label class="form-label" for="add-make">Márka *</label>
                    <input type="text" id="add-make" class="form-input" placeholder="pl. BMW" required />
                  </div>
                  <div>
                    <label class="form-label" for="add-model">Típus *</label>
                    <input type="text" id="add-model" class="form-input" placeholder="pl. M4 Competition" required />
                  </div>
                  <div>
                    <label class="form-label" for="add-price">Vételár (Ft) *</label>
                    <input type="number" id="add-price" class="form-input" placeholder="pl. 35000000" required />
                  </div>

                  <div>
                    <label class="form-label" for="add-year">Évjárat</label>
                    <input type="number" id="add-year" class="form-input" placeholder="2024" value="2024" />
                  </div>
                  <div>
                    <label class="form-label" for="add-mileage">Futásteljesítmény (km)</label>
                    <input type="number" id="add-mileage" class="form-input" placeholder="10000" />
                  </div>
                  <div>
                    <label class="form-label" for="add-displacement">Hengerűrtartalom (cm³)</label>
                    <input type="number" id="add-displacement" class="form-input" placeholder="2993" />
                  </div>

                  <div>
                    <label class="form-label" for="add-power">Teljesítmény (LE)</label>
                    <input type="number" id="add-power" class="form-input" placeholder="510" />
                  </div>
                  <div>
                    <label class="form-label" for="add-fuel">Üzemanyag</label>
                    <select id="add-fuel" class="form-select">
                      <option value="Benzin">Benzin</option>
                      <option value="Dízel">Dízel</option>
                      <option value="Hibrid">Hibrid</option>
                      <option value="Elektromos">Elektromos</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label" for="add-trans">Váltó</label>
                    <select id="add-trans" class="form-select">
                      <option value="Automata">Automata</option>
                      <option value="Manuális">Manuális</option>
                    </select>
                  </div>

                  <div class="form-group-full">
                    <label class="form-label">Autó Fotók (Több fotó feltöltése vagy Kamera használata)</label>
                    
                    <div class="dropzone" id="image-dropzone">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      <p style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">Fotózás kamerával vagy Képek tallózása</p>
                      <p style="font-size:0.75rem; color:var(--text-muted);">Több képet is kiválaszthat egyszerre a galériából vagy készíthet fotót telefonjával</p>
                      <input type="file" id="dropzone-file-input" multiple accept="image/*" capture="environment" style="display:none;" />
                    </div>
                    
                    <div style="margin-top:12px;">
                      <input type="text" id="add-image-url" class="form-input" placeholder="Kép URL hozzáadása kézzel (Enter)..." />
                    </div>

                    <div id="image-previews-container" class="image-preview-grid"></div>
                  </div>

                  <div class="form-group-full">
                    <label class="form-label" for="add-description">Részletes leírás</label>
                    <textarea id="add-description" class="form-textarea" rows="3" placeholder="Felszereltség, szervizmúlt, állapot leírása..."></textarea>
                  </div>

                  <div class="form-group-full">
                    <button type="submit" class="pin-submit-btn" style="padding:14px;">Autó közzététele a kínálatban</button>
                  </div>
                </div>
              </form>
            </div>

            <!-- TAB 2: MANAGE CARS & 1-CLICK DELETE -->
            <div id="tab-manage-cars" class="admin-tab-content" style="display:none;">
              <div id="admin-cars-table-container">
                <!-- Cars list table injected dynamically -->
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      this.bindAdminModalEvents(overlay);
    }
  }

  bindAdminModalEvents(overlay) {
    const closeBtn = overlay.querySelector('#admin-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeAdminModal());
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeAdminModal();
    });

    const tabBtns = overlay.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTabId = btn.dataset.tab;
        overlay.querySelectorAll('.admin-tab-content').forEach(content => {
          content.style.display = content.id === targetTabId ? 'block' : 'none';
        });

        if (targetTabId === 'tab-manage-cars') {
          this.renderManageCarsTable();
        }
      });
    });

    // Dropzone logic
    const dropzone = overlay.querySelector('#image-dropzone');
    const fileInput = overlay.querySelector('#dropzone-file-input');
    const urlInput = overlay.querySelector('#add-image-url');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        try {
          const base64 = await fileToBase64(file);
          this.uploadedImages.push(base64);
        } catch (err) {
          console.error(err);
        }
      }
      this.renderImagePreviews();
      fileInput.value = '';
    });

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = urlInput.value.trim();
        if (val) {
          this.uploadedImages.push(val);
          this.renderImagePreviews();
          urlInput.value = '';
        }
      }
    });

    // Form submit
    const form = overlay.querySelector('#add-car-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newCar = {
        make: overlay.querySelector('#add-make').value.trim(),
        model: overlay.querySelector('#add-model').value.trim(),
        price: Number(overlay.querySelector('#add-price').value),
        year: Number(overlay.querySelector('#add-year').value) || 2024,
        mileage: Number(overlay.querySelector('#add-mileage').value) || 0,
        displacement: Number(overlay.querySelector('#add-displacement').value) || 0,
        power: Number(overlay.querySelector('#add-power').value) || 0,
        fuel: overlay.querySelector('#add-fuel').value,
        transmission: overlay.querySelector('#add-trans').value,
        description: overlay.querySelector('#add-description').value.trim(),
        images: this.uploadedImages.length > 0 
          ? [...this.uploadedImages] 
          : ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85']
      };

      await dbService.addCar(newCar);
      showToast(`${newCar.make} ${newCar.model} (${newCar.images.length} db fotó) hozzáadva!`, 'success');

      form.reset();
      this.uploadedImages = [];
      this.renderImagePreviews();
      
      this.onCarsUpdated();
    });
  }

  renderImagePreviews() {
    const container = document.getElementById('image-previews-container');
    if (!container) return;

    container.innerHTML = this.uploadedImages.map((img, idx) => `
      <div class="preview-thumb">
        <img src="${escapeHtml(img)}" alt="Feltöltött fotó ${idx + 1}" />
        <button type="button" class="preview-remove-btn" data-idx="${idx}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.preview-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        this.uploadedImages.splice(idx, 1);
        this.renderImagePreviews();
      });
    });
  }

  async renderManageCarsTable() {
    const container = document.getElementById('admin-cars-table-container');
    if (!container) return;

    const cars = await dbService.getCars();

    if (!cars || cars.length === 0) {
      container.innerHTML = `<p style="padding:24px; text-align:center; color:var(--text-muted);">Jelenleg nincs egyetlen autó sem a rendszerben.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="admin-car-list">
        ${cars.map(car => {
          const thumb = (car.images && car.images[0]) ? car.images[0] : '';
          return `
            <div class="admin-car-card">
              <div class="admin-car-thumb-wrap">
                ${thumb ? `<img src="${escapeHtml(thumb)}" class="admin-car-thumb" alt="${escapeHtml(car.model)}" />` : '<div class="admin-car-nothumb">Nincs fotó</div>'}
              </div>
              <div class="admin-car-info">
                <div class="admin-car-title">${escapeHtml(car.make)} ${escapeHtml(car.model)}</div>
                <div class="admin-car-meta">
                  <span>${car.year || '-'}</span> • <span>${car.fuel || ''}</span> • <span>${car.power || 0} LE</span> (${(car.images || []).length} fotó)
                </div>
                <div class="admin-car-price">${formatCurrency(car.price)}</div>
              </div>
              <div class="admin-car-actions">
                <button type="button" class="btn-delete-car" data-delete-id="${car.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Törlés</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.btn-delete-car').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.deleteId;
        const carToDelete = cars.find(c => c.id === id);
        
        await dbService.deleteCar(id);
        showToast(`A(z) ${carToDelete ? carToDelete.make + ' ' + carToDelete.model : 'autó'} sikeresen törölve!`, 'success');
        
        this.renderManageCarsTable();
        this.onCarsUpdated();
      });
    });
  }

  openAdminModal() {
    const overlay = document.getElementById('admin-dashboard-modal');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeAdminModal() {
    const overlay = document.getElementById('admin-dashboard-modal');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
}
