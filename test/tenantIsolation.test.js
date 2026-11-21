/**
 * Automated Test Suite: SmartAttend Application-Level Tenant Isolation
 */

const assert = require('assert');
const {
  DEFAULT_TENANT_ID,
  getTenantId,
  tenantContextMiddleware,
  scopeQueryToTenant
} = require('../server/middleware/tenantContext');

console.log('--- Running Application-Level Tenant Isolation Test Suite ---');

// Test 1: Default tenant fallback when no auth user present
const reqUnauth = { user: null, headers: {} };
assert.strictEqual(getTenantId(reqUnauth), DEFAULT_TENANT_ID, 'Test 1 Failed: Unauthenticated request must fallback to default tenant');
console.log('✓ Test 1 Passed: Default fallback (INST_MAIN) verified for unauthenticated/legacy contexts');

// Test 2: Extraction of verified institution_id from JWT payload
const reqTenantA = { user: { id: 'STU001', role: 'student', institution_id: 'INST_HARVARD' } };
assert.strictEqual(getTenantId(reqTenantA), 'INST_HARVARD', 'Test 2 Failed: Did not extract correct institution_id from req.user');
console.log('✓ Test 2 Passed: Trusted institution identity accurately extracted from JWT user context');

// Test 3: Anti-spoofing - body tampering attempt neutralized
const reqTampered = {
  user: { id: 'PROF001', role: 'professor', institution_id: 'INST_TECH' },
  body: { action: 'save_session', institution_id: 'INST_COMPETITOR' },
  query: {}
};
tenantContextMiddleware(reqTampered, {}, () => {});
assert.strictEqual(reqTampered.body.institution_id, 'INST_TECH', 'Test 3 Failed: Request body tenant spoofing was not overridden');
assert.strictEqual(reqTampered.tenantId, 'INST_TECH', 'Test 3 Failed: req.tenantId not set correctly');
console.log('✓ Test 3 Passed: Tenant spoofing in request body successfully intercepted and neutralized');

// Test 4: Anti-spoofing - query parameter tampering attempt neutralized
const reqTamperedQuery = {
  user: { id: 'ADMIN001', role: 'admin', institution_id: 'INST_LEGAL' },
  body: {},
  query: { sheet: 'student', institution_id: 'INST_OTHER' }
};
tenantContextMiddleware(reqTamperedQuery, {}, () => {});
assert.strictEqual(reqTamperedQuery.query.institution_id, 'INST_LEGAL', 'Test 4 Failed: Query string tenant spoofing was not overridden');
assert.strictEqual(reqTamperedQuery.tenantId, 'INST_LEGAL', 'Test 4 Failed: req.tenantId not set correctly');
console.log('✓ Test 4 Passed: Tenant spoofing in query parameters intercepted and neutralized');

// Test 5: Query scoping helper appends correct equality filter
let filterColumn = null;
let filterValue = null;
const mockQuery = {
  eq: (col, val) => {
    filterColumn = col;
    filterValue = val;
    return mockQuery;
  }
};
scopeQueryToTenant(mockQuery, reqTenantA, 'institution_id');
assert.strictEqual(filterColumn, 'institution_id', 'Test 5 Failed: Column must be institution_id');
assert.strictEqual(filterValue, 'INST_HARVARD', 'Test 5 Failed: Filter value must match tenant ID');
console.log('✓ Test 5 Passed: Query scoping helper strictly binds query to tenant boundary');

console.log('All 5 Tenant Isolation tests passed successfully!\n');
