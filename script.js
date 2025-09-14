/* Updated script.js */
// ==========================================
// API CONFIGURATION - SWECHA CORPUS API
// ==========================================
const API_CONFIG = {
    // Base API URL
    BASE_URL: 'https://api.corpus.swecha.org',
    
    // API endpoints
    LOGIN_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/auth/login',
    OTP_LOGIN_SEND_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/auth/login/send-otp',
    OTP_LOGIN_VERIFY_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/auth/login/verify-otp',
    FORGOT_PASSWORD_INIT_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/auth/forgot-password/init'
};

/*
OTP API Endpoints Documentation:

1. Send Login OTP: /api/v1/auth/login/send-otp
   - Method: POST
   - Body: { "phone_number": "+91XXXXXXXXXX" }
   - Response: { "status": "string", "message": "string", "reference_id": "string" }
   - Error (422): { "detail": [{ "loc": ["string", 0], "msg": "string", "type": "string" }] }

2. Verify Login OTP: /api/v1/auth/login/verify-otp
   - Method: POST
   - Body: { "phone_number": "+91XXXXXXXXXX", "otp_code": "123456" }
   - Response: { "access_token": "string", "token_type": "bearer", "user_id": "string", "phone_number": "string", "roles": [] }
   - Error (422): { "detail": [{ "loc": ["string", 0], "msg": "string", "type": "string" }] }
*/

// ==========================================
// DOM ELEMENTS
// ==========================================
const loginForm = document.getElementById('loginForm');
const phoneNumberInput = document.getElementById('phoneNumber');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginWithOtpBtn = document.getElementById('loginWithOtpBtn');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const otpSection = document.getElementById('otpSection');
const otpDigits = document.querySelectorAll('.otp-digit');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');

// Message elements
const loginError = document.getElementById('loginError');
const loginSuccess = document.getElementById('loginSuccess');
const otpError = document.getElementById('otpError');
const otpSuccess = document.getElementById('otpSuccess');

// Global variable to store the OTP purpose (login or password_reset)
let currentOtpPurpose = '';

// ==========================================
// PHONE NUMBER FORMATTING
// ==========================================
phoneNumberInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    // Auto-add +91 for Indian numbers if not already present
    if (value.length > 0 && !value.startsWith('91')) {
        if (value.length <= 10) {
            value = '91' + value;
        }
    }
    
    // Format as +91 XXXXX XXXXX
    if (value.startsWith('91') && value.length > 2) {
        const countryCode = value.substring(0, 2);
        const number = value.substring(2);
        if (number.length <= 10) {
            e.target.value = '+' + countryCode + ' ' + number;
        }
    }
    
    // Limit to 15 characters (+91 XXXXX XXXXX)
    if (e.target.value.length > 15) {
        e.target.value = e.target.value.substring(0, 15);
    }
});

// ==========================================
// LOGIN & OTP FUNCTIONALITY
// ==========================================

// Handle standard password login
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    await handlePasswordLogin();
});

async function handlePasswordLogin() {
    const phoneNumber = phoneNumberInput.value.trim();
    const password = passwordInput.value.trim();

    // Validation
    if (!phoneNumber || !password) {
        showError('loginError', 'Please fill in all fields');
        return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
        showError('loginError', 'Please enter a valid Indian phone number');
        return;
    }

    if (password.length < 6) {
        showError('loginError', 'Password must be at least 6 characters');
        return;
    }

    setLoading(loginBtn, true);
    hideMessages();

    try {
        const requestBody = {
            phone_number: cleanPhoneNumber(phoneNumber),
            password: password
        };
        
        console.log('Sending login request to:', API_CONFIG.LOGIN_ENDPOINT);
        console.log('Request payload:', requestBody);
        console.log('Phone number being sent:', cleanPhoneNumber(phoneNumber));
        
        const response = await fetch(API_CONFIG.LOGIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        console.log('Response status:', response.status);
        console.log('Response body:', result);

        if (response.ok && result.access_token) {
            showSuccess('loginSuccess', 'Login successful! Redirecting...');
            
            // Store the access token
            const tokenData = {
                access_token: result.access_token,
                token_type: result.token_type || 'bearer',
                expires_at: result.expires_at || null,
                user_id: result.user_id || null
            };
            
            // Save to localStorage for persistence
            localStorage.setItem('auth_token', JSON.stringify(tokenData));
            
            console.log('Access token received:', result.access_token);
            console.log('Token type:', result.token_type);
            console.log('Token stored in localStorage');
            
            setTimeout(() => {
                // Use replace to prevent back button issues and ensure clean redirect
                window.location.replace('index2.html');
            }, 1500);
        } else {
            const errorMessage = result.message || result.error || 'Login failed. Please check your credentials.';
            showError('loginError', errorMessage);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('loginError', 'Network error. Please check your connection and try again.');
    } finally {
        setLoading(loginBtn, false);
    }
}

// Handle login with OTP
loginWithOtpBtn.addEventListener('click', async function() {
    const phoneNumber = phoneNumberInput.value.trim();
    if (!phoneNumber) {
        showError('loginError', 'Please enter your phone number first');
        phoneNumberInput.focus();
        return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
        showError('loginError', 'Please enter a valid phone number');
        phoneNumberInput.focus();
        return;
    }
    currentOtpPurpose = 'login';
    await requestOTP(phoneNumber, API_CONFIG.OTP_LOGIN_SEND_ENDPOINT, 'Login OTP sent successfully');
});

// Handle forgot password
forgotPasswordLink.addEventListener('click', async function(e) {
    e.preventDefault();
    const phoneNumber = phoneNumberInput.value.trim();
    if (!phoneNumber) {
        showError('loginError', 'Please enter your phone number first');
        phoneNumberInput.focus();
        return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
        showError('loginError', 'Please enter a valid phone number');
        phoneNumberInput.focus();
        return;
    }
    currentOtpPurpose = 'password_reset';
    await requestOTP(phoneNumber, API_CONFIG.FORGOT_PASSWORD_INIT_ENDPOINT, 'Password reset OTP sent successfully');
});

async function requestOTP(phoneNumber, endpoint, successMessage) {
    hideMessages();
    setLoading(loginWithOtpBtn, true);
    setLoading(forgotPasswordLink, true);

    try {
        const requestBody = {
            phone_number: cleanPhoneNumber(phoneNumber)
        };
        
        console.log('Sending OTP request to:', endpoint);
        console.log('Request payload:', requestBody);
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('OTP request response:', result);

        if (response.ok) {
            // Handle the new API response format
            if (result.status === 'success' || result.success) {
                showOTPSection(successMessage);
                otpDigits[0].focus();
                
                // Store reference_id if provided for future use
                if (result.reference_id) {
                    localStorage.setItem('otp_reference_id', result.reference_id);
                    console.log('OTP reference ID stored:', result.reference_id);
                }
            } else {
                showError('loginError', result.message || 'Failed to send OTP. Please try again.');
            }
        } else {
            // Handle validation errors (422 status)
            if (response.status === 422 && result.detail) {
                const errorMessage = result.detail[0]?.msg || 'Invalid phone number format';
                showError('loginError', errorMessage);
            } else {
                showError('loginError', result.message || 'Failed to send OTP. Please try again.');
            }
        }
    } catch (error) {
        console.error('OTP request error:', error);
        showError('loginError', 'Network error. Please check your connection and try again.');
    } finally {
        setLoading(loginWithOtpBtn, false);
        setLoading(forgotPasswordLink, false);
    }
}

// Resend OTP
resendOtpBtn.addEventListener('click', async function() {
    const phoneNumber = phoneNumberInput.value.trim();
    clearOTPInputs();
    const endpoint = currentOtpPurpose === 'login' ? API_CONFIG.OTP_LOGIN_SEND_ENDPOINT : API_CONFIG.FORGOT_PASSWORD_INIT_ENDPOINT;
    const successMessage = currentOtpPurpose === 'login' ? 'New login OTP sent successfully' : 'New password reset OTP sent successfully';
    await requestOTP(phoneNumber, endpoint, successMessage);
});

// OTP Input Handling
otpDigits.forEach((digit, index) => {
    digit.addEventListener('input', function(e) {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
        
        if (value && index < otpDigits.length - 1) {
            otpDigits[index + 1].focus();
        }
        
        if (index === otpDigits.length - 1 && value) {
            const allFilled = Array.from(otpDigits).every(d => d.value);
            if (allFilled) {
                setTimeout(() => verifyOTP(), 500);
            }
        }
        
        // Check if all digits are filled for auto-verification
        const allFilled = Array.from(otpDigits).every(d => d.value);
        if (allFilled && otpDigits.length === 6) {
            setTimeout(() => verifyOTP(), 500);
        }
    });

    digit.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            otpDigits[index - 1].focus();
            otpDigits[index - 1].value = '';
        }
        
        if (e.key === 'ArrowLeft' && index > 0) {
            otpDigits[index - 1].focus();
        }
        
        if (e.key === 'ArrowRight' && index < otpDigits.length - 1) {
            otpDigits[index + 1].focus();
        }
        
        // Allow Enter key to trigger verification
        if (e.key === 'Enter') {
            const allFilled = Array.from(otpDigits).every(d => d.value);
            if (allFilled) {
                verifyOTP();
            }
        }
    });

    digit.addEventListener('paste', function(e) {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const digits = paste.replace(/\D/g, '').substring(0, 6);
        
        for (let i = 0; i < digits.length && (index + i) < otpDigits.length; i++) {
            otpDigits[index + i].value = digits[i];
        }
        
        const nextIndex = Math.min(index + digits.length, otpDigits.length - 1);
        otpDigits[nextIndex].focus();
        
        const allFilled = Array.from(otpDigits).every(d => d.value);
        if (allFilled) {
            setTimeout(() => verifyOTP(), 500);
        }
    });
    
    // Add click event to focus the input
    digit.addEventListener('click', function() {
        this.focus();
        this.select();
    });
});

// OTP Verification
verifyOtpBtn.addEventListener('click', async function() {
    await verifyOTP();
});

async function verifyOTP() {
    const otpValue = Array.from(otpDigits).map(digit => digit.value).join('');
    
    console.log('Verifying OTP:', otpValue);
    console.log('OTP length:', otpValue.length);
    
    if (otpValue.length !== 6) {
        showError('otpError', 'Please enter the complete 6-digit OTP');
        return;
    }

    if (!/^\d{6}$/.test(otpValue)) {
        showError('otpError', 'OTP should contain only numbers');
        return;
    }

    setLoading(verifyOtpBtn, true);
    hideMessages();

    try {
        const endpoint = currentOtpPurpose === 'login' ? API_CONFIG.OTP_LOGIN_VERIFY_ENDPOINT : API_CONFIG.OTP_LOGIN_VERIFY_ENDPOINT;
        
        const body = {
            phone_number: cleanPhoneNumber(phoneNumberInput.value.trim()),
            otp_code: otpValue
        };

        // Add reference_id if available
        const referenceId = localStorage.getItem('otp_reference_id');
        if (referenceId) {
            body.reference_id = referenceId;
        }

        if (currentOtpPurpose === 'password_reset') {
            body.purpose = 'password_reset';
        }
        
        console.log('OTP verification request:', body);
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        console.log('OTP verification response:', result);

        if (response.ok && result.access_token) {
            // Clear the reference_id after successful verification
            localStorage.removeItem('otp_reference_id');
            
            if (currentOtpPurpose === 'login') {
                showSuccess('otpSuccess', 'Login successful! Redirecting...');
                
                // Store the access token
                const tokenData = {
                    access_token: result.access_token,
                    token_type: result.token_type || 'bearer',
                    expires_at: result.expires_at || null,
                    user_id: result.user_id || null
                };
                
                // Save to localStorage for persistence
                localStorage.setItem('auth_token', JSON.stringify(tokenData));
                
                console.log('Access token received via OTP:', result.access_token);
                console.log('Token type:', result.token_type);
                console.log('Token stored in localStorage');
                
                setTimeout(() => {
                    // Use replace to prevent back button issues and ensure clean redirect
                    window.location.replace('index2.html');
                }, 1500);
            } else { // password_reset
                showSuccess('otpSuccess', 'OTP verification successful! Redirecting to password reset...');
                if (result.resetToken) {
                    console.log('Reset token received:', result.resetToken);
                }
                setTimeout(() => {
                    window.location.href = '/reset-password';
                }, 2000);
            }
        } else {
            // Handle validation errors (422 status)
            if (response.status === 422 && result.detail) {
                const errorMessage = result.detail[0]?.msg || 'Invalid OTP format';
                showError('otpError', errorMessage);
            } else {
                const errorMessage = result.message || result.error || 'Invalid OTP. Please try again.';
                showError('otpError', errorMessage);
            }
            clearOTPInputs();
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        showError('otpError', 'Network error. Please check your connection and try again.');
    } finally {
        setLoading(verifyOtpBtn, false);
    }
}

// Navigation
backToLoginBtn.addEventListener('click', function() {
    hideOTPSection();
    clearOTPInputs();
    hideMessages();
    phoneNumberInput.focus();
    currentOtpPurpose = '';
    // Clear the reference_id when going back to login
    localStorage.removeItem('otp_reference_id');
});



// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function isValidPhoneNumber(phone) {
    // Remove all non-digit characters except the + symbol
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Check if it's in the format +91XXXXXXXXXX
    if (cleaned.startsWith('+91')) {
        const number = cleaned.substring(3); // Remove +91
        return number.length === 10 && /^[6-9]\d{9}$/.test(number);
    }
    
    // Check if it's in the format 91XXXXXXXXXX
    if (cleaned.startsWith('91')) {
        const number = cleaned.substring(2); // Remove 91
        return number.length === 10 && /^[6-9]\d{9}$/.test(number);
    }
    
    // Check if it's a 10-digit number
    if (cleaned.length === 10) {
        return /^[6-9]\d{9}$/.test(cleaned);
    }
    
    return false;
}

function cleanPhoneNumber(phone) {
    // Remove all non-digit characters except the + symbol
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with +91, keep the + symbol
    if (cleaned.startsWith('+91')) {
        return cleaned;
    }
    
    // If it starts with 91, add the + symbol
    if (cleaned.startsWith('91')) {
        return '+' + cleaned;
    }
    
    // If it's a 10-digit number, add +91
    if (cleaned.length === 10) {
        return '+91' + cleaned;
    }
    
    return cleaned;
}

function showOTPSection(message) {
    otpSection.classList.add('active');
    loginForm.style.opacity = '0.3';
    loginForm.style.pointerEvents = 'none';
    if (message) {
        const otpDescription = document.getElementById('otpDescription');
        if (otpDescription) {
            otpDescription.textContent = message;
        }
    }
    
    // Clear any previous OTP inputs
    clearOTPInputs();
    
    // Focus on the first OTP input
    if (otpDigits.length > 0) {
        setTimeout(() => {
            otpDigits[0].focus();
        }, 100);
    }
    
    console.log('OTP section shown with message:', message);
}

function hideOTPSection() {
    otpSection.classList.remove('active');
    loginForm.style.opacity = '1';
    loginForm.style.pointerEvents = 'auto';
}

function clearOTPInputs() {
    otpDigits.forEach(digit => {
        digit.value = '';
    });
    if (otpDigits.length > 0) {
        otpDigits[0].focus();
    }
}

function showError(elementId, message) {
    hideMessages();
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showSuccess(elementId, message) {
    hideMessages();
    const successElement = document.getElementById(elementId);
    successElement.textContent = message;
    successElement.style.display = 'block';
}

function hideMessages() {
    [loginError, loginSuccess, otpError, otpSuccess].forEach(element => {
        element.style.display = 'none';
    });
}

function setLoading(element, isLoading) {
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
        const originalText = element.textContent;
        element.dataset.originalText = originalText;
        
        if (element === loginBtn) {
            element.textContent = 'Logging in...';
        } else if (element === verifyOtpBtn) {
            element.textContent = 'Verifying...';
        } else if (element === forgotPasswordLink) {
            element.textContent = 'Sending OTP...';
        } else if (element === loginWithOtpBtn) {
            element.textContent = 'Sending OTP...';
        }
    } else {
        element.classList.remove('loading');
        element.disabled = false;
        
        if (element === loginBtn) {
            element.textContent = 'Login';
        } else if (element === verifyOtpBtn) {
            element.textContent = 'Verify OTP';
        } else if (element === forgotPasswordLink) {
            element.textContent = 'Forgot Password?';
        } else if (element === loginWithOtpBtn) {
            element.textContent = 'Login with OTP';
        }
    }
}

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        if (otpSection.classList.contains('active')) {
            const allFilled = Array.from(otpDigits).every(d => d.value);
            if (allFilled) {
                verifyOTP();
            }
        } else {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
    
    if (e.key === 'Escape' && otpSection.classList.contains('active')) {
        backToLoginBtn.click();
    }
});

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    if (isAuthenticated()) {
        console.log('User already authenticated, redirecting to main page');
        window.location.href = 'index2.html';
        return;
    }
    
    phoneNumberInput.focus();
    hideMessages();
    
    setTimeout(() => {
        document.querySelector('.login-container').style.animation = 'none';
    }, 1000);
    
    console.log('Telangana Folk Stories Login Page Initialized');
    console.log('API configured for: https://api.corpus.swecha.org');
});

// DEMO MODE - Uncomment to enable for testing
/*

*/