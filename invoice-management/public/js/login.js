document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('alertBox');
  const submitBtn = document.getElementById('submitBtn');

  // If already logged in, skip straight to the right destination.
  Api.get('/api/session-status').then((status) => {
    if (status.authenticated) {
      window.location.href = status.role === 'admin' ? '/admin.html' : '/dashboard.html';
    }
  }).catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    submitBtn.disabled = true;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const result = await Api.post('/api/login', { email, password });
      window.location.href = result.role === 'admin' ? '/admin.html' : '/dashboard.html';
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
      submitBtn.disabled = false;
    }
  });
});
