// SmartAttend Central Configuration
window.SMART_ATTEND_CONFIG = {
    // The compatibility Node.js server URL
    SCRIPT_URL: 'https://smartattend-o2te.onrender.com'
};

// Global fetch interceptor to automatically inject JWT authentication headers
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init = {}) {
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url) || '';
        const targetUrl = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

        if (urlStr.startsWith(targetUrl)) {
            // Retrieve token from sessionStorage
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
