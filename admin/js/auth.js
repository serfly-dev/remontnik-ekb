document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const formStatus = document.getElementById('formStatus');
  const loginSubmit = document.getElementById('loginSubmit');

  if (!loginForm) return;

  // Проверяем, уже ли авторизован
  if (window.userLoggedIn) {
    window.location.href = '/admin/';
    return;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Сброс предыдущего статуса
    formStatus.hidden = true;
    formStatus.className = 'form-status';
    formStatus.textContent = '';

    loginSubmit.disabled = true;
    loginSubmit.querySelector('.btn-text').textContent = 'Вход…';
    loginSubmit.querySelector('.btn-loader').hidden = false;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        window.userLoggedIn = true;
        window.location.href = '/admin/';
      } else {
        showError(data.message || 'Неверный логин или пароль');
      }
    } catch (err) {
      showError('Ошибка соединения с сервером');
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.querySelector('.btn-text').textContent = 'Войти';
      loginSubmit.querySelector('.btn-loader').hidden = true;
    }
  });

  function showError(message) {
    formStatus.textContent = message;
    formStatus.className = 'form-status error';
    formStatus.hidden = false;
  }
});