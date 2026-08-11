/**
 * Helper utilities for formatting and DOM feedback
 */

export function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'Ár érdeklődésre';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0
  }).format(amount).replace('HUF', 'Ft');
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
  if (!km && km !== 0) return 'N/A';
  return `${km.toLocaleString('hu-HU')} km`;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
