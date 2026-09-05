document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const alertBox = document.getElementById('alertBox');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    submitBtn.disabled = true;

    const payload = {
      fullName: document.getElementById('fullName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      organizationName: document.getElementById('organizationName').value.trim(),
      reason: document.getElementById('reason').value.trim(),
      verificationNote: document.getElementById('verificationNote').value.trim(),
      password: document.getElementById('password').value
    };

    try {
      const result = await Api.post('/api/register', payload);
      showAlert(alertBox, result.message, 'success');
      form.reset();
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
});
