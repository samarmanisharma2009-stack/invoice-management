document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alertBox');
  const tbody = document.getElementById('userTableBody');
  const statusFilter = document.getElementById('statusFilter');

  await guardAdmin();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await Api.post('/api/logout'); } finally { window.location.href = '/index.html'; }
  });

  statusFilter.addEventListener('change', () => loadUsers(statusFilter.value));

  await loadUsers('');

  async function loadUsers(status) {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const { users } = await Api.get(`/api/admin/users${query}`);
      tbody.innerHTML = '';
      for (const u of users) {
        const badge = el('span', { class: `badge ${u.status}` }, u.status);
        const actions = el('div', { class: 'actions-cell' });

        if (u.status !== 'approved') {
          const approveBtn = el('button', { class: 'btn small' }, 'Approve');
          approveBtn.addEventListener('click', () => act(u.id, 'approve'));
          actions.appendChild(approveBtn);
        }
        if (u.status !== 'rejected' && u.status === 'pending') {
          const rejectBtn = el('button', { class: 'btn small secondary' }, 'Reject');
          rejectBtn.addEventListener('click', () => act(u.id, 'reject'));
          actions.appendChild(rejectBtn);
        }
        if (u.status === 'approved') {
          const revokeBtn = el('button', { class: 'btn small danger' }, 'Revoke');
          revokeBtn.addEventListener('click', () => act(u.id, 'revoke'));
          actions.appendChild(revokeBtn);
        }

        const row = el('tr', {}, [
          el('td', {}, u.full_name),
          el('td', {}, u.email),
          el('td', {}, u.organization_name || '—'),
          el('td', { style: 'max-width:220px; white-space:pre-wrap;' }, u.verification_note || '—'),
          el('td', {}, badge),
          el('td', {}, new Date(u.created_at).toLocaleDateString()),
          el('td', {}, actions)
        ]);
        tbody.appendChild(row);
      }
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }

  async function act(userId, action) {
    try {
      await Api.post(`/api/admin/users/${userId}/${action}`);
      await loadUsers(statusFilter.value);
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    }
  }
});

async function guardAdmin() {
  try {
    const status = await Api.get('/api/session-status');
    if (!status.authenticated || status.role !== 'admin' || status.status !== 'approved') {
      window.location.href = '/index.html';
    }
  } catch (err) {
    window.location.href = '/index.html';
  }
}
