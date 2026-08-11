/**
 * Formázó és felületi segédfüggvények
 */

import { IMAGE_UPLOAD } from '../config.js';

export function formatCurrency(amount) {
  const num = Number(amount);
  // A 0 és a hiányzó ár egyaránt "Ár érdeklődésre" - egy 0 Ft-os autó értelmetlen.
  if (!Number.isFinite(num) || num <= 0) return 'Ár érdeklődésre';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0
  }).format(num).replace('HUF', 'Ft');
}

export function formatEngine(displacement, power, fuel) {
  const parts = [];
  if (displacement && displacement > 0) {
    parts.push(`${displacement.toLocaleString('hu-HU')} cm³`);
  }
  if (power && power > 0) {
    parts.push(`${power} LE`);
  }
  if (fuel) {
    parts.push(fuel);
  }
  return parts.join(' • ') || 'Specifikáció a részletekben';
}

export function formatMileage(km) {
  const num = Number(km);
  if (!Number.isFinite(num) || num < 0) return '-';
  return `${num.toLocaleString('hu-HU')} km`;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Kép URL biztonságos beillesztéshez: csak http(s) és data:image engedélyezett.
 * Megakadályozza a javascript: sémát src attribútumban.
 */
export function safeImageUrl(url) {
  const str = String(url || '').trim();
  if (/^https?:\/\//i.test(str) || /^data:image\//i.test(str)) {
    return escapeHtml(str);
  }
  return '';
}

// ------------------------------------------------------------------ Képek ----

/**
 * Átméretezi és tömöríti a képet feltöltés előtt.
 * Egy telefonfotó 3-8 MB; ez ~150-400 KB-ra hozza le a minőség érdemi
 * romlása nélkül. Enélkül a főoldal betöltése percekig tartana mobilneten.
 *
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`A(z) "${file.name}" nem képfájl.`));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { maxDimension, quality } = IMAGE_UPLOAD;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Fehér alap, hogy az átlátszó PNG-k ne legyenek feketék JPEG-ként.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('A kép feldolgozása nem sikerült.')),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`A(z) "${file.name}" képet nem sikerült beolvasni.`));
    };

    img.src = url;
  });
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --------------------------------------------------------------- Értesítés ----

export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    // Képernyőolvasók is megkapják az üzenetet.
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  // A hibaüzenet tovább maradjon kint, hogy legyen idő elolvasni.
  const lifetime = type === 'error' ? 6000 : 3500;

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, lifetime);
}

/**
 * Megerősítő párbeszéd visszavonhatatlan műveletekhez.
 * @returns {Promise<boolean>}
 */
export function confirmAction({ title, message, confirmLabel = 'Igen, törlöm', danger = true }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 class="confirm-title" id="confirm-title">${escapeHtml(title)}</h3>
        <p class="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn-cancel">Mégsem</button>
          <button type="button" class="confirm-btn-ok ${danger ? 'danger' : ''}">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const previouslyFocused = document.activeElement;

    const close = (result) => {
      overlay.classList.remove('active');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        overlay.remove();
        if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      }, 200);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    };

    overlay.querySelector('.confirm-btn-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-btn-ok').addEventListener('click', () => close(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);

    setTimeout(() => overlay.querySelector('.confirm-btn-cancel').focus(), 60);
  });
}

// ----------------------------------------------------------- Akadálymentes ----

/**
 * Fókuszcsapda modálhoz: a Tab nem szökik ki a párbeszédablakból.
 * @returns {Function} leszereléshez hívandó függvény
 */
export function trapFocus(container) {
  const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll(SELECTOR))
      .filter(el => el.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}
