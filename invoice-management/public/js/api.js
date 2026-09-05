/**
 * Small fetch wrapper shared by all pages.
 * - Sends/receives JSON.
 * - Attaches the CSRF token (fetched once and cached) to mutating requests.
 * - Uses textContent-based escaping helpers so pages never rely on innerHTML
 *   with untrusted data.
 */
const Api = (() => {
  let cachedCsrfToken = null;

  async function getCsrfToken() {
    if (cachedCsrfToken) return cachedCsrfToken;
    const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    const data = await res.json();
    cachedCsrfToken = data.csrfToken;
    return cachedCsrfToken;
  }

  async function request(method, url, body) {
    const options = {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };

    if (!['GET', 'HEAD'].includes(method)) {
      options.headers['X-CSRF-Token'] = await getCsrfToken();
    }
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // no body
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  return {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    del: (url) => request('DELETE', url)
  };
})();

/** Safely set text content — never use innerHTML with untrusted values. */
function setText(el, value) {
  el.textContent = value === null || value === undefined ? '' : String(value);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function showAlert(container, message, type = 'error') {
  container.innerHTML = '';
  const box = el('div', { class: `alert ${type}` }, message);
  container.appendChild(box);
}

function formatCurrency(value) {
  const n = Number(value);
  return isNaN(n) ? '0.00' : n.toFixed(2);
}
