// Login handler
document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();

    // Get values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-message');

    // Check username and password
    if (username === 'admin' && password === 'password') {
        // Go to dashboard
        window.location.href = 'dashboard.html';
    } else {
        // Show error
        errorMsg.textContent = 'Invalid username or password!';
    }
});
