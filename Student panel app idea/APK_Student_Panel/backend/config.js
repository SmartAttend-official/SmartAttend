// ==============================================================================
// SmartAttend Central API Configuration (Student Panel & APK App)
// ==============================================================================
// Evaluates the API backend target in priority order:
// 1. Explicit browser override: localStorage.getItem('SMARTATTEND_BACKEND_URL')
// 2. Localhost auto-detect: http://localhost:<port> (defaults to 3000)
// 3. Cloud production deployment: https://smartattend-o2te.onrender.com
//
// How to switch backend URLs:
// • For local testing: Run server on localhost:3000 (or set localStorage.setItem('SMARTATTEND_BACKEND_URL', 'http://localhost:3000'))
// • For custom cloud deployment: localStorage.setItem('SMARTATTEND_BACKEND_URL', 'https://your-custom-api.onrender.com')
// • To reset to default: localStorage.removeItem('SMARTATTEND_BACKEND_URL')
// ==============================================================================

(function() {
    const customOverride = typeof localStorage !== 'undefined' ? localStorage.getItem('SMARTATTEND_BACKEND_URL') : null;
    const isLocalhost = typeof window !== 'undefined' && 
                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    let resolvedBackendUrl = 'https://smartattend-o2te.onrender.com';
    if (customOverride) {
        resolvedBackendUrl = customOverride.replace(/\/+$/, '');
    } else if (isLocalhost) {
        const localPort = window.location.port === '10000' ? '10000' : '3000';
        resolvedBackendUrl = `http://localhost:${localPort}`;
    }

    window.SMART_ATTEND_CONFIG = {
        SCRIPT_URL: resolvedBackendUrl,
        IS_LOCAL: isLocalhost,
        ENVIRONMENT: isLocalhost ? 'development' : 'production'
    };
})();

// Global fetch interceptor to automatically inject JWT authentication headers
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init = {}) {
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url) || '';
        const targetUrl = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

        if (urlStr.startsWith(targetUrl)) {
            // Retrieve token from sessionStorage or localStorage
            const token = sessionStorage.getItem('smartattend_token') || 
                          localStorage.getItem('smartattend_token') ||
                          sessionStorage.getItem('token') || 
                          localStorage.getItem('token') ||
                          sessionStorage.getItem('sessionToken');
            if (token) {
                init.headers = init.headers || {};
                if (init.headers instanceof Headers) {
                    if (!init.headers.has('Authorization')) init.headers.set('Authorization', `Bearer ${token}`);
                } else if (Array.isArray(init.headers)) {
                    if (!init.headers.some(h => h[0].toLowerCase() === 'authorization')) init.headers.push(['Authorization', `Bearer ${token}`]);
                } else {
                    if (!init.headers['Authorization'] && !init.headers['authorization']) init.headers['Authorization'] = `Bearer ${token}`;
                }
            }
        }
        return originalFetch(resource, init);
    };
})();
