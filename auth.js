
// ==========================================
// TOKEN MANAGEMENT FUNCTIONS
// ==========================================

function getAuthToken() {
    try {
        const tokenData = localStorage.getItem('auth_token');
        console.log('Retrieved token data from localStorage:', tokenData);
        if (tokenData) {
            const parsed = JSON.parse(tokenData);
            console.log('Parsed access token:', parsed.access_token);
            return parsed.access_token;
        }
        return null;
    } catch (error) {
        console.error('Error parsing auth token:', error);
        return null;
    }
}

function getTokenData() {
    try {
        const tokenData = localStorage.getItem('auth_token');
        if (tokenData) {
            return JSON.parse(tokenData);
        }
        return null;
    } catch (error) {
        console.error('Error parsing auth token:', error);
        return null;
    }
}

function isAuthenticated() {
    const token = getAuthToken();
    if (!token) return false;
    
    // Check if token is expired (if expires_at is available)
    const tokenData = getTokenData();
    if (tokenData && tokenData.expires_at) {
        const now = Date.now() / 1000; // Current time in seconds
        if (now >= tokenData.expires_at) {
            // Token expired, remove it
            localStorage.removeItem('auth_token');
            return false;
        }
    }
    
    return true;
}

function logout() {
    localStorage.removeItem('auth_token');
    console.log('User logged out, token removed');
    // Redirect to login page
    window.location.href = 'index.html';
}
