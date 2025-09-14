

// Single authentication check when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔒 Checking authentication status...');
        
        if (!isAuthenticated()) {
            console.log('❌ User not authenticated, redirecting to login');
            const authCheck = document.getElementById('authCheck');
            const mainContent = document.getElementById('mainContent');
            if (authCheck) authCheck.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';
            
            setTimeout(() => {
                window.location.replace('index.html');
            }, 1000);
            return;
        }
        
        console.log('✅ User authenticated successfully');
        const tokenData = getTokenData();
        console.log('Token data:', tokenData);
        
        // Show main content
        const authCheck = document.getElementById('authCheck');
        const mainContent = document.getElementById('mainContent');
        if (authCheck) authCheck.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        
        // Initialize the upload functionality
        initializeUploadFunctionality();
    }, 500);
});

// ==========================================
// API CONFIGURATION - SWECHA CORPUS API
// ==========================================
const API_CONFIG = {
    BASE_URL: 'https://api.corpus.swecha.org',
    RECORD_UPLOAD_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/records/upload',
    CHUNK_UPLOAD_ENDPOINT: 'https://api.corpus.swecha.org/api/v1/records/upload/chunk',
};

// Upload configuration
const UPLOAD_CONFIG = {
    CHUNK_SIZE: 1024 * 1024, // 1MB chunks
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    USE_CHUNKED_UPLOAD: false, // Set to false for simpler upload
};

// File type configurations
const FILE_TYPE_CONFIG = {
    music: {
        extensions: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg'],
        maxSize: 50 * 1024 * 1024, // 50MB
        mediaType: 'audio'
    },
    video: {
        extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
        mimeTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv'],
        maxSize: 200 * 1024 * 1024, // 200MB
        mediaType: 'video'
    },
    photo: {
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
        maxSize: 10 * 1024 * 1024, // 10MB
        mediaType: 'image'
    },
    story: {
        extensions: ['.pdf', '.doc', '.docx', '.txt'],
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        maxSize: 5 * 1024 * 1024, // 5MB
        mediaType: 'text'
    }
};

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let cameraStream = null;
const selectedFiles = {
    music: [],
    video: [],
    photo: [],
    story: []
};

// ==========================================
// INITIALIZATION FUNCTION
// ==========================================
function initializeUploadFunctionality() {
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }

    // Display user info if available
    const tokenData = getTokenData();
    if (tokenData && tokenData.user_id) {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = `Welcome, User ${tokenData.user_id.substring(0, 8)}...`;
        }
    }

    // Setup file upload handlers
    setupFileUploadHandlers();
    setupCameraFunctionality();
    setupDragAndDropForAllTypes();
    setupKeyboardShortcuts();
}

// ==========================================
// FILE UPLOAD HANDLERS SETUP
// ==========================================
function setupFileUploadHandlers() {
    const fileTypes = ['music', 'video', 'photo', 'story'];
    
    fileTypes.forEach(type => {
        const input = document.getElementById(`${type}Input`);
        const uploadArea = document.getElementById(`${type}UploadArea`);
        const uploadBtn = document.getElementById(`${type}UploadBtn`);
        
        if (input) {
            input.addEventListener('change', function(e) {
                handleFileSelection(type, e.target.files);
            });
        }
        
        if (uploadArea) {
            uploadArea.addEventListener('click', function() {
                if (input) input.click();
            });
        }
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function() {
                uploadFiles(type);
            });
        }
    });
}

// ==========================================
// CAMERA FUNCTIONALITY
// ==========================================
function setupCameraFunctionality() {
    const cameraBtn = document.getElementById('cameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    
    if (cameraBtn) {
        cameraBtn.addEventListener('click', async function() {
            await toggleCamera();
        });
    }
    
    if (captureBtn) {
        captureBtn.addEventListener('click', function() {
            capturePhoto();
        });
    }
}

async function toggleCamera() {
    const cameraPreview = document.getElementById('cameraPreview');
    const cameraBtn = document.getElementById('cameraBtn');
    
    if (cameraStream) {
        // Stop camera
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        if (cameraPreview) cameraPreview.classList.remove('active');
        if (cameraBtn) {
            cameraBtn.textContent = 'Use Camera';
            cameraBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
        }
    } else {
        // Start camera
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                } 
            });
            
            const videoElement = document.getElementById('cameraVideo');
            if (videoElement) {
                videoElement.srcObject = cameraStream;
            }
            if (cameraPreview) cameraPreview.classList.add('active');
            if (cameraBtn) {
                cameraBtn.textContent = 'Stop Camera';
                cameraBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
            }
        } catch (error) {
            console.error('Camera access error:', error);
            showStatus('photo', 'error', 'Camera access denied. Please check permissions.');
        }
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('captureCanvas');
    const capturedImage = document.getElementById('capturedImage');
    
    if (!cameraStream || !video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(function(blob) {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        if (capturedImage) {
            capturedImage.src = url;
            capturedImage.style.display = 'block';
        }
        
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        selectedFiles.photo = [file];
        updateFilePreview('photo', [file]);
        
        showStatus('photo', 'success', 'Photo captured successfully!');
    }, 'image/jpeg', 0.9);
}

// ==========================================
// DRAG AND DROP FUNCTIONALITY
// ==========================================
function setupDragAndDropForAllTypes() {
    ['music', 'video', 'photo', 'story'].forEach(type => {
        setupDragAndDrop(type);
    });
}

function setupDragAndDrop(type) {
    const uploadArea = document.getElementById(`${type}UploadArea`);
    
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFileSelection(type, e.dataTransfer.files);
    });
}

// ==========================================
// FILE HANDLING FUNCTIONS
// ==========================================
function handleFileSelection(type, files) {
    if (!files || files.length === 0) return;
    
    const validFiles = validateFiles(type, files);
    if (validFiles.length === 0) return;
    
    selectedFiles[type] = validFiles;
    updateFilePreview(type, validFiles);
    
    showStatus(type, 'success', `${validFiles.length} file(s) selected successfully`);
}

function validateFiles(type, files) {
    const validFiles = [];
    const config = FILE_TYPE_CONFIG[type];
    
    if (!config) return validFiles;
    
    Array.from(files).forEach(file => {
        if (file.size > config.maxSize) {
            showStatus(type, 'error', `File "${file.name}" is too large. Maximum size: ${formatFileSize(config.maxSize)}`);
            return;
        }
        
        // Check MIME type or file extension
        const isValidType = config.mimeTypes.some(mimeType => file.type === mimeType) ||
                           config.extensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (!isValidType) {
            showStatus(type, 'error', `File "${file.name}" is not a supported format for ${type}`);
            return;
        }
        
        validFiles.push(file);
    });
    
    return validFiles;
}

function updateFilePreview(type, files) {
    const preview = document.getElementById(`${type}Preview`);
    const fileInfo = document.getElementById(`${type}FileInfo`);
    
    if (!preview || !fileInfo) return;
    
    if (files.length === 1) {
        fileInfo.textContent = `Selected: ${files[0].name} (${formatFileSize(files[0].size)})`;
    } else {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        fileInfo.textContent = `Selected: ${files.length} files (${formatFileSize(totalSize)} total)`;
    }
    
    preview.classList.add('show');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// MAIN UPLOAD FUNCTION
// ==========================================
async function uploadFiles(type) {
    const files = selectedFiles[type];
    
    if (!files || files.length === 0) {
        showStatus(type, 'error', 'Please select files first');
        return;
    }

    const uploadBtn = document.getElementById(`${type}UploadBtn`);
    const progressBar = document.getElementById(`${type}Progress`);
    
    if (!uploadBtn || !progressBar) {
        console.error('Upload button or progress bar not found');
        return;
    }
    
    setButtonLoading(uploadBtn, true);
    hideStatus(type);
    
    try {
        // Get authentication token
        const authToken = getAuthToken();
        if (!authToken) {
            showStatus(type, 'error', 'Authentication required. Please login again.');
            setTimeout(() => logout(), 2000);
            return;
        }

        // Get user data from token
        const tokenData = getTokenData();
        const userId = tokenData?.user_id || generateFallbackUserId();

        // Get user's current location
        const userLocation = await getUserLocation();
        
        // Upload each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            console.log(`Uploading ${type} file:`, file.name);
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', file);
            
            // Add metadata
            const metadata = {
                title: file.name.replace(/\.[^/.]+$/, "") || `Uploaded ${type} file`,
                description: `Telugu folk ${type} content: ${file.name}. Uploaded via SWECHA Corpus Portal.`,
                category_id: getCategoryId(type),
                user_id: userId,
                media_type: FILE_TYPE_CONFIG[type].mediaType,
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                release_rights: "creator",
                language: "telugu",
                filename: file.name
            };
            
            // Add metadata to FormData
            Object.keys(metadata).forEach(key => {
                formData.append(key, metadata[key]);
            });
            
            // Simulate progress
            const progressInterval = setInterval(() => {
                const currentWidth = parseFloat(progressBar.style.width) || 0;
                if (currentWidth < 90) {
                    progressBar.style.width = (currentWidth + Math.random() * 10) + '%';
                }
            }, 200);

            try {
                const headers = {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                    // Don't set Content-Type for FormData - let browser set it with boundary
                };
                console.log('Uploading with headers:', headers);

                const response = await fetch(API_CONFIG.RECORD_UPLOAD_ENDPOINT, {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });

                clearInterval(progressInterval);

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        errorData = { message: errorText || 'Upload failed' };
                    }
                    
                    throw new Error(errorData.detail?.[0]?.msg || errorData.message || `Upload failed with status ${response.status}`);
                }

                const result = await response.json();
                console.log(`File ${file.name} uploaded successfully:`, result);
                
            } catch (fetchError) {
                clearInterval(progressInterval);
                throw fetchError;
            }
            
            // Update progress for this file
            const progress = ((i + 1) / files.length) * 100;
            progressBar.style.width = progress + '%';
        }

        // All files uploaded successfully
        progressBar.style.width = '100%';
        showStatus(type, 'success', `${files.length} file(s) uploaded successfully!`);
        
        // Clear selection and reset UI after delay
        setTimeout(() => {
            resetUploadSection(type);
            const uploadArea = document.querySelector(`#${type}UploadArea`);
            if (uploadArea) {
                uploadArea.classList.add('upload-success');
                setTimeout(() => {
                    uploadArea.classList.remove('upload-success');
                }, 600);
            }
        }, 2000);
        
    } catch (error) {
        console.error(`${type} upload error:`, error);
        showStatus(type, 'error', error.message || 'Upload failed. Please try again.');
        
        // Reset progress bar on error
        const progressBar = document.getElementById(`${type}Progress`);
        if (progressBar) {
            progressBar.style.width = '0%';
        }
    } finally {
        setButtonLoading(uploadBtn, false);
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getCategoryId(type) {
    // Default category UUID - you may need to adjust these based on your API
    return '3fa85f64-5717-4562-b3fc-2c963f66afa6';
}

function generateFallbackUserId() {
    return '3fa85f64-5717-4562-b3fc-2c963f66afa6';
}

async function getUserLocation() {
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('Could not get location:', error);
                    // Default to Hyderabad coordinates
                    resolve({
                        latitude: 17.385,
                        longitude: 78.4867
                    });
                },
                { timeout: 10000, enableHighAccuracy: true }
            );
        } else {
            // Default to Hyderabad coordinates
            resolve({
                latitude: 17.385,
                longitude: 78.4867
            });
        }
    });
}

function resetUploadSection(type) {
    selectedFiles[type] = [];
    const input = document.getElementById(`${type}Input`);
    const preview = document.getElementById(`${type}Preview`);
    const progress = document.getElementById(`${type}Progress`);
    
    if (input) input.value = '';
    if (preview) preview.classList.remove('show');
    if (progress) progress.style.width = '0%';
    hideStatus(type);
}

// ==========================================
// UI HELPER FUNCTIONS
// ==========================================
function showStatus(type, status, message) {
    const statusElement = document.getElementById(`${type}Status`);
    if (!statusElement) return;
    
    statusElement.className = `status-message status-${status}`;
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Auto-hide error and info messages after 5 seconds
    if (status === 'error' || status === 'info') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

function hideStatus(type) {
    const statusElement = document.getElementById(`${type}Status`);
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.classList.add('loading');
        button.dataset.originalText = button.textContent;
        button.textContent = 'Uploading...';
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.textContent = button.dataset.originalText || button.textContent.replace('Uploading...', 'Upload');
        button.disabled = false;
    }
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Escape key to stop camera
        if (e.key === 'Escape' && cameraStream) {
            toggleCamera();
        }
        
        // Space bar to capture photo when camera is active
        if (e.key === ' ' && cameraStream) {
            e.preventDefault();
            capturePhoto();
        }
    });
}

// ==========================================
// CLEANUP
// ==========================================
window.addEventListener('beforeunload', function() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

// ==========================================
// DEMO MODE FOR TESTING
// ==========================================
// Uncomment this section for testing without actual API
/*
window.DEMO_MODE = true;

if (window.DEMO_MODE) {
    console.log('🎭 DEMO MODE: Upload simulation enabled');
    
    // Set a demo token for testing
    authTokenData = {
        access_token: 'demo_token_123',
        token_type: 'bearer',
        user_id: 'demo_user_123'
    };
    
    // Override fetch for demo
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        console.log('Demo fetch intercepted:', url);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        success: true,
                        message: 'File uploaded successfully (demo)',
                        id: 'demo_file_' + Date.now(),
                        filename: 'demo_file.ext',
                        url: 'https://demo-url.com/file'
                    })
                });
            }, 2000); // Simulate 2 second upload time
        });
    };
}
*/