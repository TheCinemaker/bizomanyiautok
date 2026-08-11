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

    // A logó a főoldalra visz - kivéve, ha épp az admin nyomvatartás történt.
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
    // Mobilon a hosszú nyomás ne hozza fel a rendszer menüjét.
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

  // ------------------------------------------------------------ Nyit/zár ----

  openAdminModal() {
    const overlay = document.getElementById('admin-dashboard-modal');
    if (!overlay) return;

    const emailEl = overlay.querySelector('#admin-user-email');
    if (emailEl) emailEl.textContent = this.currentUser?.email || '';

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    this.releaseFocusTrap = trapFocus(overlay.querySelector('.admin-container'));
  }

  closeAdminModal() {
    const overlay = document.getElementById('admin-dashboard-modal');
    if (!overlay) return;

    overlay.classList.remove('active');
    document.body.style.overflow = '';

    if (this.releaseFocusTrap) {
      this.releaseFocusTrap();
      this.releaseFocusTrap = null;
    }
  }
}
