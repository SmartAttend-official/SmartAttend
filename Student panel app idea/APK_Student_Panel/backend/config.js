// SmartAttend Central Configuration
// Auto-detect environment: use local server when running from localhost
const _isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
window.SMART_ATTEND_CONFIG = {
    SCRIPT_URL: _isLocal ? 'http://localhost:10000' : 'https://smartattend-o2te.onrender.com'
};

// Global fetch interceptor to automatically inject JWT authentication headers
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init = {}) {
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url) || '';
        const targetUrl = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

        if (urlStr.startsWith(targetUrl) || urlStr.startsWith('?') || urlStr.startsWith('/')) {
            // Retrieve token from sessionStorage or localStorage
            const token = sessionStorage.getItem('smartattend_token') || localStorage.getItem('smartattend_token');
            if (token) {
                init.headers = init.headers || {};
                if (init.headers instanceof Headers) {
                    init.headers.set('Authorization', `Bearer ${token}`);
                } else if (Array.isArray(init.headers)) {
                    init.headers.push(['Authorization', `Bearer ${token}`]);
                } else {
                    init.headers['Authorization'] = `Bearer ${token}`;
                }
            }
        }
        return originalFetch(resource, init);
    };
})();

