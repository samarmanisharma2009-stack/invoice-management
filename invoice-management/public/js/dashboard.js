document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alertBox');
  const tbody = document.getElementById('invoiceTableBody');
  const emptyState = document.getElementById('emptyState');

  await guardApprovedUser(alertBox);
  await loadInvoices();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await Api.post('/api/logout');
    } finally {
      window.location.href = '/index.html';
    }
  });

  async function loadInvoices() {
    try {
      const { invoices } = await Api.get('/api/invoices');
      tbody.innerHTML = '';
      if (invoices.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }
      emptyState.classList.add('hidden');

      for (const inv of invoices) {
        const statusBadge = el('span', { class: `badge ${inv.status.toLowerCase()}` }, inv.status);
        const viewBtn = el('button', { class: 'btn small secondary' }, 'View');
        viewBtn.addEventListener('click', () => {
          window.location.href = `/invoice.html?id=${encodeURIComponent(inv.id)}`;
        });
        const deleteBtn = el('button', { class: 'btn small danger' }, 'Delete');
        deleteBtn.addEventListener('click', () => deleteInvoice(inv.id));

        const row = el('tr', {}, [
          el('td', {}, inv.invoice_number),
          el('td', {}, inv.customer_name),
          el('td', {}, inv.invoice_date),
          el('td', {}, `${formatCurrency(inv.total)}`),
          el('td', {}, statusBadge),
          el('td', { class: 'actions-cell' }, [viewBtn, deleteBtn])
        ]);
        tbody.appendChild(row);
      }
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }

  async function deleteInvoice(id) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await Api.del(`/api/invoices/${id}`);
      await loadInvoices();
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }
});

/** Shared guard: redirect to login if session invalid; used on every protected page. */
async function guardApprovedUser(alertBox) {
  try {
    const status = await Api.get('/api/session-status');
    if (!status.authenticated) {
      window.location.href = '/index.html';
      return;
    }
    if (status.status !== 'approved') {
      window.location.href = '/index.html';
    }
  } catch (err) {
    window.location.href = '/index.html';
  }
}
