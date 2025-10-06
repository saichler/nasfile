// Login functionality
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = loginForm.querySelector('.login-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Hide previous error
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        // Show loading state
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        try {
            const response = await fetch('/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: username,
                    pass: password
                })
            });

            if (!response.ok) {
                throw new Error('Login request failed');
            }

            const data = await response.json();

            // Check if token exists in response
            if (data.token && data.token.trim() !== '') {
                // Store token in sessionStorage
                sessionStorage.setItem('authToken', data.token);

                // Redirect to main file manager
                window.location.href = 'filemanager.html';
            } else {
                // Login failed - empty response or no token
                showError('Invalid username or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
});