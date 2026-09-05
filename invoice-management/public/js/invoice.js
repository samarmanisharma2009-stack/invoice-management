document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alertBox');
  const itemsContainer = document.getElementById('itemsContainer');
  const customerSelect = document.getElementById('customerSelect');
  const params = new URLSearchParams(window.location.search);
  const invoiceId = params.get('id');

  await guardApprovedUser();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await Api.post('/api/logout'); } finally { window.location.href = '/index.html'; }
  });
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('addItemBtn').addEventListener('click', () => addItemRow());

  if (invoiceId) {
    document.getElementById('pageTitle').textContent = `Invoice #${invoiceId}`;
  }

  await loadCustomers();
  if (invoiceId) {
    await loadInvoice(invoiceId);
  } else {
    document.getElementById('invoiceDate').valueAsDate = new Date();
    addItemRow();
  }

  recalcTotals();
  itemsContainer.addEventListener('input', recalcTotals);
  document.getElementById('discountInput').addEventListener('input', recalcTotals);

  document.getElementById('saveBtn').addEventListener('click', () => saveInvoice(invoiceId));

  // ---------- helpers ----------

  async function loadCustomers() {
    try {
      const { customers } = await Api.get('/api/customers');
      customerSelect.innerHTML = '';
      customerSelect.appendChild(el('option', { value: '' }, '-- Select a customer --'));
      for (const c of customers) {
        customerSelect.appendChild(el('option', { value: c.id }, c.name));
      }
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }

  async function ensureCustomer() {
    const newName = document.getElementById('newCustomerName').value.trim();
    if (!newName) return Number(customerSelect.value) || null;
    const result = await Api.post('/api/customers', { name: newName });
    return result.id;
  }

  function addItemRow(item) {
    const row = el('div', { class: 'item-row' }, [
      el('input', { type: 'text', placeholder: 'Description', class: 'item-desc', value: item ? item.description : '' }),
      el('input', { type: 'number', placeholder: 'Qty', min: '0', step: '0.01', class: 'item-qty', value: item ? item.quantity : '1' }),
      el('input', { type: 'number', placeholder: 'Unit Price', min: '0', step: '0.01', class: 'item-price', value: item ? item.unit_price : '0' }),
      el('input', { type: 'number', placeholder: 'Tax %', min: '0', step: '0.01', class: 'item-tax', value: item ? item.tax_rate : '0' }),
      (() => {
        const btn = el('button', { type: 'button', class: 'btn small danger no-print' }, '✕');
        btn.addEventListener('click', () => { row.remove(); recalcTotals(); });
        return btn;
      })()
    ]);
    itemsContainer.appendChild(row);
  }

  function collectItems() {
    return Array.from(itemsContainer.querySelectorAll('.item-row')).map((row) => ({
      description: row.querySelector('.item-desc').value.trim(),
      quantity: Number(row.querySelector('.item-qty').value),
      unit_price: Number(row.querySelector('.item-price').value),
      tax_rate: Number(row.querySelector('.item-tax').value) || 0
    })).filter((i) => i.description.length > 0);
  }

  function recalcTotals() {
    const items = collectItems();
    let subtotal = 0, tax = 0;
    for (const item of items) {
      const lineBase = item.quantity * item.unit_price;
      subtotal += lineBase;
      tax += lineBase * (item.tax_rate / 100);
    }
    const discount = Number(document.getElementById('discountInput').value) || 0;
    const total = subtotal + tax - discount;

    setText(document.getElementById('subtotalDisplay'), formatCurrency(subtotal));
    setText(document.getElementById('taxDisplay'), formatCurrency(tax));
    setText(document.getElementById('discountDisplay'), formatCurrency(discount));
    setText(document.getElementById('totalDisplay'), formatCurrency(total));
  }

  async function loadInvoice(id) {
    try {
      const { invoice } = await Api.get(`/api/invoices/${id}`);
      customerSelect.value = invoice.customer_id;
      document.getElementById('invoiceDate').value = invoice.invoice_date;
      document.getElementById('dueDate').value = invoice.due_date || '';
      document.getElementById('statusSelect').value = invoice.status;
      document.getElementById('discountInput').value = invoice.discount;
      document.getElementById('notesInput').value = invoice.notes || '';
      itemsContainer.innerHTML = '';
      for (const item of invoice.items) addItemRow(item);
      if (invoice.items.length === 0) addItemRow();
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }

  async function saveInvoice(existingId) {
    try {
      const customerId = await ensureCustomer();
      if (!customerId) {
        showAlert(alertBox, 'Please select or enter a customer.', 'error');
        return;
      }
      const items = collectItems();
      if (items.length === 0) {
        showAlert(alertBox, 'Add at least one invoice item.', 'error');
        return;
      }

      const payload = {
        customer_id: customerId,
        invoice_date: document.getElementById('invoiceDate').value,
        due_date: document.getElementById('dueDate').value || null,
        status: document.getElementById('statusSelect').value,
        discount: Number(document.getElementById('discountInput').value) || 0,
        notes: document.getElementById('notesInput').value,
        items
      };

      if (!payload.invoice_date) {
        showAlert(alertBox, 'Invoice date is required.', 'error');
        return;
      }

      if (existingId) {
        await Api.put(`/api/invoices/${existingId}`, payload);
        showAlert(alertBox, 'Invoice updated.', 'success');
      } else {
        const result = await Api.post('/api/invoices', payload);
        showAlert(alertBox, `Invoice ${result.invoice_number} created.`, 'success');
        setTimeout(() => { window.location.href = `/invoice.html?id=${result.id}`; }, 800);
      }
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }
});

async function guardApprovedUser() {
  try {
    const status = await Api.get('/api/session-status');
    if (!status.authenticated || status.status !== 'approved') {
      window.location.href = '/index.html';
    }
  } catch (err) {
    window.location.href = '/index.html';
  }
}
