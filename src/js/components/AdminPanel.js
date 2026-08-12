import { dbService } from '../db.js';
import {
  compressImage, formatFileSize, showToast, escapeHtml,
  safeImageUrl, formatCurrency, confirmAction, trapFocus
} from '../utils/helpers.js';
import { IMAGE_UPLOAD } from '../config.js';

const LONG_PRESS_MS = 2000;

export class AdminPanel {
  constructor(options = {}) {
    this.onCarsUpdated = options.onCarsUpdated || (() => {});

    this.currentUser = null;
    this.editingCarId = null;
    /** @type {Array<{kind:'file'|'url', blob?:Blob, url:string, label:string}>} */
    this.pendingImages = [];
    this.releaseFocusTrap = null;

    this.createLoginModal();
    this.createAdminModal();
    this.setupLongPressTrigger();
    this.restoreSession();
  }

  async restoreSession() {
    try {
      this.currentUser = await dbService.getCurrentUser();
    } catch {
      this.currentUser = null;
    }
  }

  // -------------------------------------------------------- Belépési pont ----

  setupLongPressTrigger() {
    // 1. Fejléc Admin gomb
    const headerAdminBtn = document.getElementById('btn-admin-header');
    if (headerAdminBtn) {
      headerAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.requestAccess();
      });
    }

    // 2. Lábléc Adminisztráció hivatkozás
    const footerAdminLink = document.getElementById('footer-admin-link');
    if (footerAdminLink) {
      footerAdminLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.requestAccess();
      });
    }

    // 3. Logó nyomvatartásos belépés
    const logoEl = document.getElementById('brand-logo-trigger');
    if (!logoEl) return;

    let pressTimer = null;
    let triggered = false;

    const startPress = () => {
      triggered = false;
      logoEl.classList.add('holding-admin');
      pressTimer = setTimeout(() => {
        triggered = true;
        logoEl.classList.remove('holding-admin');
        this.requestAccess();
      }, LONG_PRESS_MS);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      logoEl.classList.remove('holding-admin');
    };

    logoEl.addEventListener('click', (e) => {
      if (triggered) {
        e.preventDefault();
        triggered = false;
      }
    });

    logoEl.addEventListener('mousedown', startPress);
    logoEl.addEventListener('mouseup', cancelPress);
    logoEl.addEventListener('mouseleave', cancelPress);
    logoEl.addEventListener('touchstart', startPress, { passive: true });
    logoEl.addEventListener('touchend', cancelPress);
    logoEl.addEventListener('touchcancel', cancelPress);
    logoEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  async requestAccess() {
    if (!this.currentUser) {
      this.currentUser = await dbService.getCurrentUser();
    }
    this.currentUser ? this.openAdminModal() : this.openLoginModal();
  }

  // ---------------------------------------------------------------- Login ----

  createLoginModal() {
    if (document.getElementById('admin-login-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'admin-login-modal';
    overlay.className = 'pin-modal-overlay';
    overlay.innerHTML = `
      <div class="pin-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button type="button" class="pin-close-btn" id="login-close-btn" aria-label="Bezárás">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="pin-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>

        <h3 class="pin-title" id="login-title">Adminisztrátori belépés</h3>
        <p class="pin-subtitle">A készletkezelő felület csak a kereskedés munkatársai számára érhető el.</p>

        <form id="admin-login-form" novalidate>
          <div class="login-field">
            <label class="form-label" for="login-email">E-mail cím</label>
            <input type="email" id="login-email" class="form-input" autocomplete="username" required />
          </div>
          <div class="login-field">
            <label class="form-label" for="login-password">Jelszó</label>
            <input type="password" id="login-password" class="form-input" autocomplete="current-password" required />
          </div>

          <p class="login-error" id="login-error" role="alert" hidden></p>

          <button type="submit" class="pin-submit-btn" id="login-submit-btn">Belépés</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#login-close-btn').addEventListener('click', () => this.closeLoginModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeLoginModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) this.closeLoginModal();
    });

    overlay.querySelector('#admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailEl = overlay.querySelector('#login-email');
      const passEl = overlay.querySelector('#login-password');
      const errorEl = overlay.querySelector('#login-error');
      const submitBtn = overlay.querySelector('#login-submit-btn');

      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Belépés folyamatban...';

      try {
        this.currentUser = await dbService.signIn(emailEl.value, passEl.value);
        passEl.value = '';
        this.closeLoginModal();
        this.openAdminModal();
        showToast('Sikeres bejelentkezés.', 'success');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        passEl.value = '';
        passEl.focus();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Belépés';
      }
    });
  }

  openLoginModal() {
    const overlay = document.getElementById('admin-login-modal');
    if (!overlay) return;

    overlay.querySelector('#login-error').hidden = true;
    overlay.querySelector('#login-password').value = '';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => overlay.querySelector('#login-email').focus(), 80);
  }

  closeLoginModal() {
    const overlay = document.getElementById('admin-login-modal');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  async signOut() {
    await dbService.signOut();
    this.currentUser = null;
    this.closeAdminModal();
    showToast('Kijelentkezve.', 'info');
  }

  // ------------------------------------------------------------ Admin UI ----

  createAdminModal() {
    if (document.getElementById('admin-dashboard-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'admin-dashboard-modal';
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-container" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <div class="admin-header">
          <div class="admin-title-wrap">
            <span class="admin-badge">Adminisztráció</span>
            <h2 class="admin-title" id="admin-title">Készletkezelő felület</h2>
          </div>
          <div class="admin-header-actions">
            <span class="admin-user-email" id="admin-user-email"></span>
            <button type="button" class="btn-signout" id="admin-signout-btn">Kijelentkezés</button>
            <button type="button" class="modal-close-btn admin-close" id="admin-close-btn" aria-label="Bezárás">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="admin-tabs" role="tablist">
          <button type="button" class="admin-tab-btn active" data-tab="tab-add-car" role="tab" aria-selected="true">Autó felvitele</button>
          <button type="button" class="admin-tab-btn" data-tab="tab-manage-cars" role="tab" aria-selected="false">Készlet kezelése</button>
          <button type="button" class="admin-tab-btn" data-tab="tab-inquiries" role="tab" aria-selected="false">
            Érdeklődések <span id="inquiries-tab-badge" class="inquiries-tab-badge" hidden>0</span>
          </button>
        </div>

        <div class="admin-body">
          <div id="tab-add-car" class="admin-tab-content">
            <div class="editing-banner" id="editing-banner" hidden>
              <span id="editing-banner-text"></span>
              <button type="button" class="btn-cancel-edit" id="btn-cancel-edit">Szerkesztés megszakítása</button>
            </div>

            <form id="car-form">
              <div class="form-grid">
                <div>
                  <label class="form-label" for="add-make">Márka *</label>
                  <input type="text" id="add-make" class="form-input" placeholder="pl. BMW" required maxlength="60" />
                </div>
                <div>
                  <label class="form-label" for="add-model">Típus *</label>
                  <input type="text" id="add-model" class="form-input" placeholder="pl. M4 Competition" required maxlength="120" />
                </div>
                <div>
                  <label class="form-label" for="add-price">Vételár (Ft) *</label>
                  <input type="number" id="add-price" class="form-input" placeholder="35000000" required min="0" step="1000" />
                </div>

                <div>
                  <label class="form-label" for="add-year">Évjárat</label>
                  <input type="number" id="add-year" class="form-input" placeholder="2024" min="1900" max="2100" />
                </div>
                <div>
                  <label class="form-label" for="add-mileage">Futásteljesítmény (km)</label>
                  <input type="number" id="add-mileage" class="form-input" placeholder="10000" min="0" />
                </div>
                <div>
                  <label class="form-label" for="add-displacement">Hengerűrtartalom (cm³)</label>
                  <input type="number" id="add-displacement" class="form-input" placeholder="2993" min="0" />
                </div>

                <div>
                  <label class="form-label" for="add-power">Teljesítmény (LE)</label>
                  <input type="number" id="add-power" class="form-input" placeholder="510" min="0" />
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

                <div>
                  <label class="form-label" for="add-color">Szín</label>
                  <input type="text" id="add-color" class="form-input" placeholder="pl. Nardo szürke" maxlength="60" />
                </div>
                <div>
                  <label class="form-label" for="add-inspection">Műszaki érvényesség</label>
                  <input type="text" id="add-inspection" class="form-input" placeholder="pl. 2026.11.20" maxlength="30" />
                </div>
                <div>
                  <label class="form-label" for="add-condition">Állapot</label>
                  <select id="add-condition" class="form-select">
                    <option value="Újszerű">Újszerű</option>
                    <option value="Kitűnő" selected>Kitűnő</option>
                    <option value="Jó">Jó</option>
                    <option value="Felújítandó">Felújítandó</option>
                  </select>
                </div>

                <div class="form-group-full">
                  <label class="form-label">Autó fotók</label>

                  <div class="dropzone" id="image-dropzone" tabindex="0" role="button" aria-label="Fotók kiválasztása">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <p class="dropzone-title">Fotók kiválasztása vagy ide húzása</p>
                    <p class="dropzone-hint">Telefonon a kamera is választható. A képeket feltöltés előtt automatikusan ${IMAGE_UPLOAD.maxDimension}px-re kicsinyítjük és tömörítjük.</p>
                    <input type="file" id="dropzone-file-input" multiple accept="image/*" hidden />
                  </div>

                  <div class="url-add-row">
                    <input type="url" id="add-image-url" class="form-input" placeholder="Kép URL beillesztése..." />
                    <button type="button" class="btn-add-url" id="btn-add-url">Hozzáadás</button>
                  </div>

                  <div id="image-previews-container" class="image-preview-grid"></div>
                </div>

                <div class="form-group-full">
                  <label class="form-label" for="add-description">Részletes leírás</label>
                  <textarea id="add-description" class="form-textarea" rows="4" maxlength="3000" placeholder="Felszereltség, szervizmúlt, állapot leírása..."></textarea>
                </div>

                <div class="form-group-full">
                  <button type="submit" class="pin-submit-btn admin-submit-btn" id="car-form-submit">Autó közzététele</button>
                </div>
              </div>
            </form>
          </div>

          <div id="tab-manage-cars" class="admin-tab-content" hidden>
            <div id="admin-cars-table-container"></div>
          </div>

          <div id="tab-inquiries" class="admin-tab-content" hidden>
            <div class="inquiries-header-bar">
              <div>
                <h3 class="inquiries-title">Beérkezett Vevői Érdeklődések (Valós idejű / Realtime)</h3>
                <p class="inquiries-subtitle">Az új megkeresések azonnal, csengőszóval jelennek meg a felületen.</p>
              </div>
              <button type="button" class="btn-refresh-inquiries" id="btn-refresh-inquiries">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Frissítés</span>
              </button>
            </div>
            <div id="admin-inquiries-list-container"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.bindAdminModalEvents(overlay);
  }

  bindAdminModalEvents(overlay) {
    overlay.querySelector('#admin-close-btn').addEventListener('click', () => this.closeAdminModal());
    overlay.querySelector('#admin-signout-btn').addEventListener('click', () => this.signOut());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeAdminModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !overlay.classList.contains('active')) return;
      // Ha megerősítő párbeszéd van nyitva fölötte, azt zárja az Escape,
      // ne csukja be alóla az egész admin felületet.
      if (document.querySelector('.confirm-overlay')) return;
      this.closeAdminModal();
    });

    // Fülek
    const tabBtns = overlay.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const targetId = btn.dataset.tab;
        overlay.querySelectorAll('.admin-tab-content').forEach(c => {
          c.hidden = c.id !== targetId;
        });

        if (targetId === 'tab-manage-cars') this.renderManageCarsTable();
        if (targetId === 'tab-inquiries') this.renderInquiriesList();
      });
    });

    // Fotók
    const dropzone = overlay.querySelector('#image-dropzone');
    const fileInput = overlay.querySelector('#dropzone-file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => this.handleFiles(e.dataTransfer.files));

    fileInput.addEventListener('change', async (e) => {
      await this.handleFiles(e.target.files);
      fileInput.value = '';
    });

    // Kép URL
    const urlInput = overlay.querySelector('#add-image-url');
    const addUrlBtn = overlay.querySelector('#btn-add-url');

    const addUrl = () => {
      const val = urlInput.value.trim();
      if (!val) return;
      if (!safeImageUrl(val)) {
        showToast('Csak http:// vagy https:// kezdetű kép URL adható meg.', 'error');
        return;
      }
      this.pendingImages.push({ kind: 'url', url: val, label: 'URL' });
      this.renderImagePreviews();
      urlInput.value = '';
    };

    addUrlBtn.addEventListener('click', addUrl);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addUrl(); }
    });

    // Szerkesztés megszakítása
    overlay.querySelector('#btn-cancel-edit').addEventListener('click', () => this.resetForm());

    // Mentés
    overlay.querySelector('#car-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
  }

  // ---------------------------------------------------------------- Fotók ----

  async handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const room = IMAGE_UPLOAD.maxFiles - this.pendingImages.length;
    if (room <= 0) {
      showToast(`Autónként legfeljebb ${IMAGE_UPLOAD.maxFiles} fotó tölthető fel.`, 'error');
      return;
    }

    const batch = files.slice(0, room);
    if (files.length > room) {
      showToast(`Csak az első ${room} fotót vettük fel (max. ${IMAGE_UPLOAD.maxFiles}).`, 'info');
    }

    let originalBytes = 0;
    let compressedBytes = 0;

    for (const file of batch) {
      try {
        const blob = await compressImage(file);
        originalBytes += file.size;
        compressedBytes += blob.size;

        this.pendingImages.push({
          kind: 'file',
          blob,
          url: URL.createObjectURL(blob),
          label: formatFileSize(blob.size)
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    this.renderImagePreviews();

    if (compressedBytes > 0 && originalBytes > compressedBytes * 1.2) {
      showToast(
        `${batch.length} fotó előkészítve: ${formatFileSize(originalBytes)} → ${formatFileSize(compressedBytes)}`,
        'success'
      );
    }
  }

  renderImagePreviews() {
    const container = document.getElementById('image-previews-container');
    if (!container) return;

    if (this.pendingImages.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <p class="preview-count">${this.pendingImages.length} fotó — az első lesz a borítókép</p>
      <div class="preview-list">
        ${this.pendingImages.map((img, idx) => `
          <div class="preview-thumb ${idx === 0 ? 'is-cover' : ''}">
            <img src="${img.kind === 'file' ? img.url : safeImageUrl(img.url)}" alt="Fotó ${idx + 1}" />
            ${idx === 0 ? '<span class="preview-cover-badge">Borító</span>' : ''}
            <span class="preview-size">${escapeHtml(img.label)}</span>
            <div class="preview-actions">
              ${idx > 0 ? `<button type="button" class="preview-move-btn" data-move="${idx}" aria-label="Előrébb mozgatás">‹</button>` : ''}
              <button type="button" class="preview-remove-btn" data-remove="${idx}" aria-label="Fotó eltávolítása">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.remove);
        const [removed] = this.pendingImages.splice(idx, 1);
        if (removed?.kind === 'file') URL.revokeObjectURL(removed.url);
        this.renderImagePreviews();
      });
    });

    container.querySelectorAll('[data-move]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.move);
        [this.pendingImages[idx - 1], this.pendingImages[idx]] =
          [this.pendingImages[idx], this.pendingImages[idx - 1]];
        this.renderImagePreviews();
      });
    });
  }

  clearPendingImages() {
    this.pendingImages.forEach(img => {
      if (img.kind === 'file') URL.revokeObjectURL(img.url);
    });
    this.pendingImages = [];
  }

  // ---------------------------------------------------------------- Mentés ----

  async handleFormSubmit(e) {
    e.preventDefault();

    const overlay = document.getElementById('admin-dashboard-modal');
    const submitBtn = overlay.querySelector('#car-form-submit');
    const $ = (id) => overlay.querySelector(`#${id}`);

    const make = $('add-make').value.trim();
    const model = $('add-model').value.trim();
    const price = Number($('add-price').value);

    if (!make || !model) {
      showToast('A márka és a típus megadása kötelező.', 'error');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showToast('Adj meg érvényes vételárat.', 'error');
      return;
    }

    const isEdit = Boolean(this.editingCarId);
    const carId = this.editingCarId || `car-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    submitBtn.disabled = true;

    try {
      // 1) Fotók feltöltése a tárolóba
      const imageUrls = [];
      let uploaded = 0;
      const toUpload = this.pendingImages.filter(i => i.kind === 'file').length;

      for (const img of this.pendingImages) {
        if (img.kind === 'url') {
          imageUrls.push(img.url);
          continue;
        }
        uploaded++;
        submitBtn.textContent = `Fotó feltöltése (${uploaded}/${toUpload})...`;
        imageUrls.push(await dbService.uploadCarPhoto(img.blob, carId));
      }

      submitBtn.textContent = isEdit ? 'Módosítás mentése...' : 'Közzététel...';

      // 2) Adatsor összeállítása
      const payload = {
        make,
        model,
        price,
        year: Number($('add-year').value) || null,
        mileage: Number($('add-mileage').value) || 0,
        displacement: Number($('add-displacement').value) || 0,
        power: Number($('add-power').value) || 0,
        fuel: $('add-fuel').value,
        transmission: $('add-trans').value,
        color: $('add-color').value.trim() || null,
        inspection_validity: $('add-inspection').value.trim() || null,
        condition: $('add-condition').value,
        description: $('add-description').value.trim() || null,
        images: imageUrls
      };

      if (isEdit) {
        await dbService.updateCar(carId, payload);
        showToast(`${make} ${model} módosítása mentve.`, 'success');
      } else {
        await dbService.addCar({ ...payload, id: carId });
        showToast(`${make} ${model} közzétéve (${imageUrls.length} fotó).`, 'success');
      }

      this.resetForm();
      this.onCarsUpdated();
    } catch (err) {
      console.error(err);
      const errMsg = err.message || 'A mentés nem sikerült.';
      showToast(errMsg, 'error');

      if (/munkamenet|lejárt|bejelentkezz/i.test(errMsg)) {
        this.openLoginModal();
      }
    } finally {
      submitBtn.disabled = false;
      // Sikeres mentés után a resetForm már törölte az editingCarId-t, így
      // a felirat visszaáll a helyes alapállapotra.
      submitBtn.textContent = this.editingCarId ? 'Módosítások mentése' : 'Autó közzététele';
    }
  }

  resetForm() {
    const overlay = document.getElementById('admin-dashboard-modal');
    if (!overlay) return;

    overlay.querySelector('#car-form').reset();
    overlay.querySelector('#add-condition').value = 'Kitűnő';
    this.clearPendingImages();
    this.renderImagePreviews();

    this.editingCarId = null;
    overlay.querySelector('#editing-banner').hidden = true;
    overlay.querySelector('#car-form-submit').textContent = 'Autó közzététele';
  }

  startEdit(car) {
    const overlay = document.getElementById('admin-dashboard-modal');
    const $ = (id) => overlay.querySelector(`#${id}`);

    this.editingCarId = car.id;

    $('add-make').value = car.make || '';
    $('add-model').value = car.model || '';
    $('add-price').value = car.price ?? '';
    $('add-year').value = car.year ?? '';
    $('add-mileage').value = car.mileage ?? '';
    $('add-displacement').value = car.displacement ?? '';
    $('add-power').value = car.power ?? '';
    $('add-fuel').value = car.fuel || 'Benzin';
    $('add-trans').value = car.transmission || 'Automata';
    $('add-color').value = car.color || '';
    $('add-inspection').value = car.inspection_validity || '';
    $('add-condition').value = car.condition || 'Kitűnő';
    $('add-description').value = car.description || '';

    // A meglévő fotók URL-ként kerülnek be, így nem töltődnek fel újra.
    this.clearPendingImages();
    this.pendingImages = (car.images || [])
      .filter(u => safeImageUrl(u))
      .map(u => ({ kind: 'url', url: u, label: 'meglévő' }));
    this.renderImagePreviews();

    $('editing-banner-text').textContent = `Szerkesztés alatt: ${car.make} ${car.model}`;
    $('editing-banner').hidden = false;
    $('car-form-submit').textContent = 'Módosítások mentése';

    // Váltás az űrlap fülre
    overlay.querySelectorAll('.admin-tab-btn').forEach(b => {
      const isTarget = b.dataset.tab === 'tab-add-car';
      b.classList.toggle('active', isTarget);
      b.setAttribute('aria-selected', String(isTarget));
    });
    overlay.querySelectorAll('.admin-tab-content').forEach(c => {
      c.hidden = c.id !== 'tab-add-car';
    });

    overlay.querySelector('.admin-body').scrollTop = 0;
    $('add-make').focus();
  }

  // ------------------------------------------------------------- Készlet ----

  async renderManageCarsTable() {
    const container = document.getElementById('admin-cars-table-container');
    if (!container) return;

    container.innerHTML = '<p class="admin-placeholder">Betöltés...</p>';

    let cars = [];
    try {
      cars = await dbService.getCars();
    } catch (err) {
      container.innerHTML = `<p class="admin-placeholder admin-placeholder-error">${escapeHtml(err.message)}</p>`;
      return;
    }

    if (cars.length === 0) {
      container.innerHTML = '<p class="admin-placeholder">Jelenleg nincs autó a rendszerben.</p>';
      return;
    }

    container.innerHTML = `
      <p class="admin-list-summary">${cars.length} autó a kínálatban</p>
      <div class="admin-car-list">
        ${cars.map(car => {
          const thumb = safeImageUrl(car.images?.[0]);
          return `
            <div class="admin-car-card">
              <div class="admin-car-thumb-wrap">
                ${thumb
                  ? `<img src="${thumb}" class="admin-car-thumb" alt="" loading="lazy" />`
                  : '<div class="admin-car-nothumb">Nincs fotó</div>'}
              </div>
              <div class="admin-car-info">
                <div class="admin-car-title">${escapeHtml(`${car.make || ''} ${car.model || ''}`.trim())}</div>
                <div class="admin-car-meta">
                  ${escapeHtml(car.year || '-')} • ${escapeHtml(car.fuel || '-')} • ${escapeHtml(car.power || 0)} LE • ${(car.images || []).length} fotó
                </div>
                <div class="admin-car-price">${escapeHtml(formatCurrency(car.price))}</div>
              </div>
              <div class="admin-car-actions">
                <button type="button" class="btn-service-log" data-service-id="${escapeHtml(car.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                  <span>Szerviznapló</span>
                </button>
                <button type="button" class="btn-generate-contract" data-contract-id="${escapeHtml(car.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>Adásvételi</span>
                </button>
                <button type="button" class="btn-edit-car" data-edit-id="${escapeHtml(car.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"></path>
                  </svg>
                  <span>Szerkesztés</span>
                </button>
                <button type="button" class="btn-delete-car" data-delete-id="${escapeHtml(car.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
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

    container.querySelectorAll('[data-service-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const car = cars.find(c => c.id === btn.dataset.serviceId);
        if (car) this.openServiceLogModal(car);
      });
    });

    container.querySelectorAll('[data-contract-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const car = cars.find(c => c.id === btn.dataset.contractId);
        if (car) this.openContractGeneratorModal(car);
      });
    });

    container.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const car = cars.find(c => c.id === btn.dataset.editId);
        if (car) this.startEdit(car);
      });
    });

    container.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteId;
        const car = cars.find(c => c.id === id);
        const label = car ? `${car.make} ${car.model}` : 'a kiválasztott autó';

        // Korábban egyetlen kattintás véglegesen törölt, visszavonás nélkül.
        const confirmed = await confirmAction({
          title: 'Autó végleges törlése',
          message: `Biztosan törlöd a következőt: ${label}? A hirdetés és a hozzá tartozó fotók véglegesen törlődnek. A művelet nem vonható vissza.`,
          confirmLabel: 'Igen, törlöm'
        });
        if (!confirmed) return;

        btn.disabled = true;
        try {
          await dbService.deleteCar(id);
          await dbService.deleteCarPhotos(id);
          showToast(`${label} törölve.`, 'success');
          this.renderManageCarsTable();
          this.onCarsUpdated();
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  // ---------------------------------------------------- Érdeklődések (Realtime) ----

  playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // AudioContext ok
    }
  }

  setupInquiryRealtime() {
    if (this.realtimeChannel) return;

    this.realtimeChannel = dbService.subscribeInquiries((payload) => {
      if (payload.eventType === 'INSERT') {
        this.playNotificationChime();
        const newInquiry = payload.new;
        showToast(`ÚJ ÉRDEKLŐDÉS: ${newInquiry.name} (${newInquiry.car_label || 'Autó'})`, 'info');
      }
      this.updateInquiryBadge();
      const inquiriesTab = document.getElementById('tab-inquiries');
      if (inquiriesTab && !inquiriesTab.hidden) {
        this.renderInquiriesList();
      }
    });
  }

  async updateInquiryBadge() {
    const badge = document.getElementById('inquiries-tab-badge');
    if (!badge) return;

    try {
      const inquiries = await dbService.getInquiries();
      const unhandledCount = inquiries.filter(i => !i.handled).length;
      if (unhandledCount > 0) {
        badge.textContent = unhandledCount;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    } catch {
      badge.hidden = true;
    }
  }

  async renderInquiriesList() {
    const container = document.getElementById('admin-inquiries-list-container');
    if (!container) return;

    container.innerHTML = `<p style="padding:20px; text-align:center; color:var(--text-muted);">Érdeklődések betöltése...</p>`;

    try {
      const inquiries = await dbService.getInquiries();
      this.updateInquiryBadge();

      if (!inquiries || inquiries.length === 0) {
        container.innerHTML = `<div class="empty-inquiries"><p style="padding:32px; text-align:center; color:var(--text-muted);">Még nem érkezett egyetlen érdeklődés sem.</p></div>`;
        return;
      }

      const refreshBtn = document.getElementById('btn-refresh-inquiries');
      if (refreshBtn) {
        refreshBtn.onclick = () => this.renderInquiriesList();
      }

      container.innerHTML = `
        <div class="inquiry-card-list">
          ${inquiries.map(item => `
            <div class="inquiry-card ${item.handled ? 'is-handled' : 'is-new'}">
              <div class="inquiry-card-header">
                <span class="inquiry-badge ${item.handled ? 'handled' : 'new'}">
                  <span class="status-dot"></span>
                  ${item.handled ? 'Elintézve' : 'ÚJ ÉRDEKLŐDÉS'}
                </span>
                <span class="inquiry-date">${new Date(item.created_at).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>

              <div class="inquiry-car-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A2 2 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
                <strong>${escapeHtml(item.car_label || 'Gépjármű érdeklődés')}</strong>
              </div>

              <div class="inquiry-customer-grid">
                <div class="inquiry-customer-item">
                  <span class="inquiry-label">Vevő Neve</span>
                  <strong class="inquiry-val">${escapeHtml(item.name)}</strong>
                </div>
                <div class="inquiry-customer-item">
                  <span class="inquiry-label">Telefonszám</span>
                  <a href="tel:${escapeHtml(item.phone.replace(/[^\d+]/g, ''))}" class="inquiry-phone-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>${escapeHtml(item.phone)} (Hívás)</span>
                  </a>
                </div>
                ${item.email ? `
                  <div class="inquiry-customer-item">
                    <span class="inquiry-label">E-mail Cím</span>
                    <a href="mailto:${escapeHtml(item.email)}" class="inquiry-email-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <span>${escapeHtml(item.email)}</span>
                    </a>
                  </div>
                ` : ''}
              </div>

              ${item.message ? `
                <div class="inquiry-message">
                  <strong>Vevő Üzenete:</strong> "${escapeHtml(item.message)}"
                </div>
              ` : ''}

              <div class="inquiry-card-footer">
                <button type="button" class="btn-toggle-handled ${item.handled ? 'is-handled-btn' : ''}" data-handled-id="${item.id}" data-current-state="${item.handled}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>${item.handled ? 'Visszaállítás Új állapotba' : 'Megjelölés elintézettként'}</span>
                </button>
                <button type="button" class="btn-delete-inquiry" data-delete-inquiry-id="${item.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Törlés</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Event listeners
      container.querySelectorAll('[data-handled-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.handledId;
          const currentState = btn.dataset.currentState === 'true';
          btn.disabled = true;
          try {
            await dbService.toggleInquiryHandled(id, !currentState);
            showToast(currentState ? 'Érdeklődés újként megjelölve.' : 'Érdeklődés elintézve.', 'success');
            this.renderInquiriesList();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      container.querySelectorAll('[data-delete-inquiry-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.deleteInquiryId;
          const confirmed = await confirmAction({
            title: 'Érdeklődés törlése',
            message: 'Biztosan törlöd ezt az érdeklődést? A művelet nem vonható vissza.',
            confirmLabel: 'Igen, törlöm'
          });
          if (!confirmed) return;

          btn.disabled = true;
          try {
            await dbService.deleteInquiry(id);
            showToast('Érdeklődés törölve.', 'success');
            this.renderInquiriesList();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

    } catch (err) {
      console.error('Érdeklődések betöltési hiba:', err);
      container.innerHTML = `<p style="padding:20px; text-align:center; color:var(--accent-danger);">${escapeHtml(err.message)}</p>`;
    }
  }

  // ------------------------------------------------------------ Nyit/zár ----

  // -------------------------------------------------------- Szerviznapló Modal ----

  async openServiceLogModal(car) {
    let overlay = document.getElementById('service-log-modal');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'service-log-modal';
    overlay.className = 'admin-modal-overlay active';
    overlay.innerHTML = `
      <div class="admin-container service-log-container" role="dialog" aria-modal="true">
        <div class="admin-header">
          <div class="admin-title-wrap">
            <span class="admin-badge">Belső irodai nyilvántartás</span>
            <h2 class="admin-title">Szerviz- és Javítási Napló</h2>
            <p class="inquiries-subtitle">${escapeHtml(car.make)} ${escapeHtml(car.model)} (${escapeHtml(formatCurrency(car.price))})</p>
          </div>
          <button type="button" class="modal-close-btn" id="service-close-btn" aria-label="Bezárás">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="admin-body">
          <div class="service-add-box">
            <h4 class="service-form-title">Új szervizbejegyzés / javítás felvitele</h4>
            <form id="service-log-form">
              <div class="form-grid">
                <div>
                  <label class="form-label" for="s-date">Dátum *</label>
                  <input type="date" id="s-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div>
                  <label class="form-label" for="s-cost">Költség (Ft)</label>
                  <input type="number" id="s-cost" class="form-input" placeholder="0" min="0" step="500" />
                </div>
                <div>
                  <label class="form-label" for="s-performed">Végrehajtotta / Szerviz</label>
                  <input type="text" id="s-performed" class="form-input" placeholder="pl. Iroda / Szerviz" maxlength="80" />
                </div>
                <div class="form-group-full">
                  <label class="form-label" for="s-desc">Javítás / Elvégzett munka / Hiányosság *</label>
                  <textarea id="s-desc" class="form-textarea" rows="2" required placeholder="pl. Olajcsere, légszűrő, fékbetét cserélve, bal első lökös karcos..."></textarea>
                </div>
                <div class="form-group-full">
                  <button type="submit" class="pin-submit-btn">Bejegyzés mentése</button>
                </div>
              </div>
            </form>
          </div>

          <h4 class="service-history-title">Előző javítások és szerviztörténet</h4>
          <div id="service-history-list">
            <p style="padding:15px; text-align:center; color:var(--text-muted);">Szerviznapló betöltése...</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelector('#service-close-btn').onclick = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    const renderLogs = async () => {
      const listEl = overlay.querySelector('#service-history-list');
      try {
        const logs = await dbService.getServiceLogs(car.id);
        if (logs.length === 0) {
          listEl.innerHTML = `<p style="padding:20px; text-align:center; color:var(--text-muted);">Még nincs szervizbejegyzés ehhez az autóhoz.</p>`;
          return;
        }

        const totalCost = logs.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

        listEl.innerHTML = `
          <div class="service-total-bar">
            <span>Összes ráfordított szervizköltség:</span>
            <strong>${formatCurrency(totalCost)}</strong>
          </div>
          <div class="service-log-items">
            ${logs.map(log => `
              <div class="service-log-item">
                <div class="service-log-main">
                  <div class="service-log-date-row">
                    <span class="service-log-date">${log.service_date || ''}</span>
                    ${log.cost ? `<span class="service-log-cost">${formatCurrency(log.cost)}</span>` : ''}
                  </div>
                  <div class="service-log-desc">${escapeHtml(log.description)}</div>
                  ${log.performed_by ? `<div class="service-log-by">Végrehajtotta: ${escapeHtml(log.performed_by)}</div>` : ''}
                </div>
                <button type="button" class="btn-delete-service-item" data-del-log="${log.id}">Törlés</button>
              </div>
            `).join('')}
          </div>
        `;

        listEl.querySelectorAll('[data-del-log]').forEach(btn => {
          btn.onclick = async () => {
            if (!confirm('Biztosan törlöd ezt a szervizbejegyzést?')) return;
            try {
              await dbService.deleteServiceLog(btn.dataset.delLog);
              showToast('Bejegyzés törölve.', 'success');
              renderLogs();
            } catch (err) {
              showToast(err.message, 'error');
            }
          };
        });

      } catch (err) {
        listEl.innerHTML = `<p style="padding:15px; color:var(--accent-danger);">${escapeHtml(err.message)}</p>`;
      }
    };

    renderLogs();

    overlay.querySelector('#service-log-form').onsubmit = async (e) => {
      e.preventDefault();
      const desc = overlay.querySelector('#s-desc').value.trim();
      if (!desc) return;

      try {
        await dbService.addServiceLog({
          car_id: car.id,
          service_date: overlay.querySelector('#s-date').value,
          description: desc,
          cost: Number(overlay.querySelector('#s-cost').value) || 0,
          performed_by: overlay.querySelector('#s-performed').value.trim() || null
        });
        showToast('Szervizbejegyzés mentve.', 'success');
        overlay.querySelector('#s-desc').value = '';
        overlay.querySelector('#s-cost').value = '';
        renderLogs();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // ------------------------------------ Hivatalos Adásvételi Generáló Modal ----

  openContractGeneratorModal(car) {
    let overlay = document.getElementById('contract-modal');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'contract-modal';
    overlay.className = 'admin-modal-overlay active';
    overlay.innerHTML = `
      <div class="admin-container contract-modal-container" role="dialog" aria-modal="true">
        <div class="admin-header">
          <div class="admin-title-wrap">
            <span class="admin-badge">Kormányablak Kompatibilis Nyomtatvány</span>
            <h2 class="admin-title">Gépjármű Adásvételi Szerződés Generáló</h2>
            <p class="inquiries-subtitle">Hivatalos 4 példányos nyomtatás és Supabase mentés</p>
          </div>
          <button type="button" class="modal-close-btn" id="contract-close-btn" aria-label="Bezárás">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="admin-body">
          <form id="contract-form">
            <!-- Jármű adatok -->
            <div class="contract-form-section">
              <h4 class="contract-form-sec-title">1. A Gépjármű Adatai</h4>
              <div class="form-grid">
                <div>
                  <label class="form-label">Gyártmány / Típus</label>
                  <input type="text" id="c-car-label" class="form-input" value="${escapeHtml(car.make)} ${escapeHtml(car.model)}" required />
                </div>
                <div>
                  <label class="form-label">Alvázszám (VIN) *</label>
                  <input type="text" id="c-vin" class="form-input" placeholder="pl. WBA1234567890" required maxlength="30" />
                </div>
                <div>
                  <label class="form-label">Motorszám / Motorkód</label>
                  <input type="text" id="c-engine-no" class="form-input" placeholder="pl. B48B20O1" maxlength="30" />
                </div>
                <div>
                  <label class="form-label">Rendszám</label>
                  <input type="text" id="c-plate" class="form-input" placeholder="pl. AA-BB-123" maxlength="15" />
                </div>
                <div>
                  <label class="form-label">Forgalmi Engedély Száma *</label>
                  <input type="text" id="c-reg-no" class="form-input" placeholder="pl. FE123456" required maxlength="20" />
                </div>
                <div>
                  <label class="form-label">Törzskönyv Száma *</label>
                  <input type="text" id="c-title-no" class="form-input" placeholder="pl. TK123456" required maxlength="20" />
                </div>
                <div>
                  <label class="form-label">Évjárat</label>
                  <input type="number" id="c-year" class="form-input" value="${car.year || ''}" />
                </div>
                <div>
                  <label class="form-label">Kilométeróra Állás (km) *</label>
                  <input type="number" id="c-mileage" class="form-input" value="${car.mileage || ''}" required min="0" />
                </div>
                <div>
                  <label class="form-label">Vételár (Ft) *</label>
                  <input type="number" id="c-price" class="form-input" value="${car.price || ''}" required min="0" />
                </div>
              </div>
            </div>

            <!-- Eladó adatok -->
            <div class="contract-form-section">
              <h4 class="contract-form-sec-title">2. Eladó Adatai (Tulajdonos / Kereskedés)</h4>
              <div class="form-grid">
                <div>
                  <label class="form-label">Eladó Neve / Cégnév *</label>
                  <input type="text" id="c-seller-name" class="form-input" value="MOZSÓ Bizományos Autók" required />
                </div>
                <div>
                  <label class="form-label">Születési Név / Cégjegyzékszám</label>
                  <input type="text" id="c-seller-birthname" class="form-input" placeholder="Születési név..." />
                </div>
                <div>
                  <label class="form-label">Születési Hely, Idő</label>
                  <input type="text" id="c-seller-birthplace" class="form-input" placeholder="Budapest, 1985.05.10." />
                </div>
                <div>
                  <label class="form-label">Anyja Születési Neve</label>
                  <input type="text" id="c-seller-mother" class="form-input" placeholder="Anyja neve..." />
                </div>
                <div>
                  <label class="form-label">Személyi Igazolvány / Adószám *</label>
                  <input type="text" id="c-seller-idno" class="form-input" required placeholder="123456AB / 12345678-1-42" />
                </div>
                <div>
                  <label class="form-label">Lakcím / Székhely *</label>
                  <input type="text" id="c-seller-address" class="form-input" required placeholder="City, utca, házszám..." />
                </div>
              </div>
            </div>

            <!-- Vevő adatok -->
            <div class="contract-form-section">
              <h4 class="contract-form-sec-title">3. Vevő Adatai</h4>
              <div class="form-grid">
                <div>
                  <label class="form-label">Vevő Neve / Cégnév *</label>
                  <input type="text" id="c-buyer-name" class="form-input" required placeholder="Kovács István" />
                </div>
                <div>
                  <label class="form-label">Születési Név</label>
                  <input type="text" id="c-buyer-birthname" class="form-input" placeholder="Születési név..." />
                </div>
                <div>
                  <label class="form-label">Születési Hely, Idő</label>
                  <input type="text" id="c-buyer-birthplace" class="form-input" placeholder="Debrecen, 1990.08.12." />
                </div>
                <div>
                  <label class="form-label">Anyja Születési Neve</label>
                  <input type="text" id="c-buyer-mother" class="form-input" placeholder="Anyja neve..." />
                </div>
                <div>
                  <label class="form-label">Személyi Igazolvány Száma *</label>
                  <input type="text" id="c-buyer-idno" class="form-input" required placeholder="654321XY" />
                </div>
                <div>
                  <label class="form-label">Lakcím / Székhely *</label>
                  <input type="text" id="c-buyer-address" class="form-input" required placeholder="Város, utca, házszám..." />
                </div>
              </div>
            </div>

            <!-- Tanúk adatai -->
            <div class="contract-form-section">
              <h4 class="contract-form-sec-title">4. Tanúk Adatai (Opcionális, de kötelező az okmányirodában!)</h4>
              <div class="form-grid">
                <div>
                  <label class="form-label">1. Tanú Neve</label>
                  <input type="text" id="c-w1-name" class="form-input" placeholder="Név..." />
                </div>
                <div>
                  <label class="form-label">1. Tanú Lakcíme</label>
                  <input type="text" id="c-w1-addr" class="form-input" placeholder="Lakcím..." />
                </div>
                <div>
                  <label class="form-label">2. Tanú Neve</label>
                  <input type="text" id="c-w2-name" class="form-input" placeholder="Név..." />
                </div>
                <div>
                  <label class="form-label">2. Tanú Lakcíme</label>
                  <input type="text" id="c-w2-addr" class="form-input" placeholder="Lakcím..." />
                </div>
              </div>
            </div>

            <div class="contract-actions-bar">
              <button type="button" class="pin-submit-btn" id="btn-print-contract">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Nyomtatás (Hivatalos 4 Példány)
              </button>
              <button type="button" class="btn-save-contract" id="btn-save-contract-db">
                Mentés Supabase Adatbázisba
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelector('#contract-close-btn').onclick = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    const generatePrintHTML = () => {
      const getVal = (id) => overlay.querySelector(`#${id}`)?.value || '';

      const carLabel = getVal('c-car-label');
      const vin = getVal('c-vin');
      const engineNo = getVal('c-engine-no');
      const plate = getVal('c-plate');
      const regNo = getVal('c-reg-no');
      const titleNo = getVal('c-title-no');
      const year = getVal('c-year');
      const mileage = getVal('c-mileage');
      const price = getVal('c-price');

      const sellerName = getVal('c-seller-name');
      const sellerBirth = getVal('c-seller-birthname');
      const sellerPlace = getVal('c-seller-birthplace');
      const sellerMother = getVal('c-seller-mother');
      const sellerId = getVal('c-seller-idno');
      const sellerAddr = getVal('c-seller-address');

      const buyerName = getVal('c-buyer-name');
      const buyerBirth = getVal('c-buyer-birthname');
      const buyerPlace = getVal('c-buyer-birthplace');
      const buyerMother = getVal('c-buyer-mother');
      const buyerId = getVal('c-buyer-idno');
      const buyerAddr = getVal('c-buyer-address');

      const w1Name = getVal('c-w1-name');
      const w1Addr = getVal('c-w1-addr');
      const w2Name = getVal('c-w2-name');
      const w2Addr = getVal('c-w2-addr');

      const copies = ['1. Példány - VEVŐÉ', '2. Példány - ELADÓÉ', '3. Példány - OKMÁNYIRODÁÉ (VEVŐ)', '4. Példány - OKMÁNYIRODÁÉ (ELADÓ)'];
      const todayStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

      return copies.map((copyLabel) => `
        <div class="contract-page">
          <div class="contract-copy-badge">${copyLabel}</div>
          <div class="contract-title">GÉPJÁRMŰ ADÁSVÉTELI SZERZŐDÉS</div>
          <div class="contract-subtitle">Amely létrejött a mai napon az alulírott felek között az alábbi feltételekkel:</div>

          <div class="contract-section-header">1. ELADÓ (Jelenlegi tulajdonos)</div>
          <div class="contract-grid">
            <div class="contract-field"><span class="contract-field-label">Név / Cég:</span> <span class="contract-field-val">${escapeHtml(sellerName)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Születési név:</span> <span class="contract-field-val">${escapeHtml(sellerBirth || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Szül. hely, idő:</span> <span class="contract-field-val">${escapeHtml(sellerPlace || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Anyja neve:</span> <span class="contract-field-val">${escapeHtml(sellerMother || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Szem.ig. / Adószám:</span> <span class="contract-field-val">${escapeHtml(sellerId)}</span></div>
            <div class="contract-field contract-full-width"><span class="contract-field-label">Lakcím / Székhely:</span> <span class="contract-field-val">${escapeHtml(sellerAddr)}</span></div>
          </div>

          <div class="contract-section-header">2. VEVŐ (Új tulajdonos)</div>
          <div class="contract-grid">
            <div class="contract-field"><span class="contract-field-label">Név / Cég:</span> <span class="contract-field-val">${escapeHtml(buyerName)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Születési név:</span> <span class="contract-field-val">${escapeHtml(buyerBirth || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Szül. hely, idő:</span> <span class="contract-field-val">${escapeHtml(buyerPlace || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Anyja neve:</span> <span class="contract-field-val">${escapeHtml(buyerMother || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Szem.ig. / Adószám:</span> <span class="contract-field-val">${escapeHtml(buyerId)}</span></div>
            <div class="contract-field contract-full-width"><span class="contract-field-label">Lakcím / Székhely:</span> <span class="contract-field-val">${escapeHtml(buyerAddr)}</span></div>
          </div>

          <div class="contract-section-header">3. A GÉPJÁRMŰ ADATAI</div>
          <div class="contract-grid">
            <div class="contract-field"><span class="contract-field-label">Gyártmány, típus:</span> <span class="contract-field-val">${escapeHtml(carLabel)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Alvázszám (VIN):</span> <span class="contract-field-val">${escapeHtml(vin)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Motorszám / kód:</span> <span class="contract-field-val">${escapeHtml(engineNo || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Rendszám:</span> <span class="contract-field-val">${escapeHtml(plate || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Forgalmi engedély:</span> <span class="contract-field-val">${escapeHtml(regNo)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Törzskönyv száma:</span> <span class="contract-field-val">${escapeHtml(titleNo)}</span></div>
            <div class="contract-field"><span class="contract-field-label">Évjárat:</span> <span class="contract-field-val">${escapeHtml(year || '-')}</span></div>
            <div class="contract-field"><span class="contract-field-label">Km óra állás:</span> <span class="contract-field-val">${escapeHtml(Number(mileage).toLocaleString('hu-HU'))} km</span></div>
          </div>

          <div class="contract-section-header">4. VÉTELÁR ÉS FIZETÉSI FELTÉTELEK</div>
          <div class="contract-legal-text">
            A gépjármű kölcsönösen megállapodott vételára: <strong>${escapeHtml(formatCurrency(price))}</strong>, azaz ${escapeHtml(formatCurrency(price))} forint.
            Az Eladó a vételár hiánytalan átvételét a szerződés aláírásával elismeri és igazolja. A Vevő a gépjárművet megtekintett, megvizsgált állapotban veszi át.
          </div>

          <div class="contract-signatures-grid">
            <div class="contract-sig-box">Eladó (Saját kezű aláírás)</div>
            <div class="contract-sig-box">Vevő (Saját kezű aláírás)</div>
          </div>

          <div class="contract-witness-section">
            <div style="font-weight:bold; font-size:9.5pt; margin-bottom:6px;">TANÚK (A szerződés kötelező alaki kelléke):</div>
            <div class="contract-grid">
              <div class="contract-field"><span class="contract-field-label">1. Tanú Neve:</span> <span class="contract-field-val">${escapeHtml(w1Name || '-')}</span></div>
              <div class="contract-field"><span class="contract-field-label">2. Tanú Neve:</span> <span class="contract-field-val">${escapeHtml(w2Name || '-')}</span></div>
              <div class="contract-field"><span class="contract-field-label">Lakcím:</span> <span class="contract-field-val">${escapeHtml(w1Addr || '-')}</span></div>
              <div class="contract-field"><span class="contract-field-label">Lakcím:</span> <span class="contract-field-val">${escapeHtml(w2Addr || '-')}</span></div>
            </div>
            <div class="contract-signatures-grid" style="margin-top:15px;">
              <div class="contract-sig-box" style="padding-top:20px;">1. Tanú aláírása</div>
              <div class="contract-sig-box" style="padding-top:20px;">2. Tanú aláírása</div>
            </div>
          </div>

          <div style="margin-top:10px; text-align:right; font-size:9pt; color:#444;">Kelt: ${todayStr}</div>
        </div>
      `).join('');
    };

    overlay.querySelector('#btn-print-contract').onclick = () => {
      const vin = overlay.querySelector('#c-vin').value.trim();
      const regNo = overlay.querySelector('#c-reg-no').value.trim();
      if (!vin || !regNo) {
        showToast('Az Alvázszám és a Forgalmi engedély száma kötelező a nyomtatáshoz!', 'error');
        return;
      }

      let printArea = document.getElementById('contract-print-area');
      if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'contract-print-area';
        document.body.appendChild(printArea);
      }

      printArea.innerHTML = generatePrintHTML();
      window.print();
    };

    overlay.querySelector('#btn-save-contract-db').onclick = async () => {
      const getVal = (id) => overlay.querySelector(`#${id}`)?.value || '';
      const sellerName = getVal('c-seller-name');
      const buyerName = getVal('c-buyer-name');
      const carLabel = getVal('c-car-label');
      const price = Number(getVal('c-price')) || 0;

      if (!sellerName || !buyerName) {
        showToast('Az Eladó és a Vevő nevének megadása kötelező a mentéshez.', 'error');
        return;
      }

      try {
        await dbService.saveContract({
          car_id: car.id,
          seller_name: sellerName,
          buyer_name: buyerName,
          car_label: carLabel,
          price: price,
          contract_data: {
            vin: getVal('c-vin'),
            engineNo: getVal('c-engine-no'),
            plate: getVal('c-plate'),
            regNo: getVal('c-reg-no'),
            titleNo: getVal('c-title-no'),
            year: getVal('c-year'),
            mileage: getVal('c-mileage'),
            sellerAddress: getVal('c-seller-address'),
            buyerAddress: getVal('c-buyer-address'),
            witness1: getVal('c-w1-name'),
            witness2: getVal('c-w2-name')
          }
        });
        showToast('Szerződés elmentve a Supabase adatbázisba.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
}
