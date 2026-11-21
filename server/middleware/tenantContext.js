/**
 * SmartAttend - Tenant Context & Isolation Middleware
 * Enforces multi-tenant data boundaries across student, attendance, and leave queries.
 */

const DEFAULT_TENANT_ID = 'INST_MAIN';

/**
 * Extracts the trusted tenant identity from the verified JWT user object.
 * Rejects or ignores any client-supplied institution_id in req.body or req.query.
 * @param {object} req - Express request object
 * @returns {string} Trusted institution_id
 */
function getTenantId(req) {
  if (req.user && req.user.institution_id) {
    return String(req.user.institution_id).trim();
  }
  if (req.tenantId) {
    return String(req.tenantId).trim();
  }
  return DEFAULT_TENANT_ID;
}

/**
 * Express middleware to establish tenant context and neutralize parameter spoofing.
 */
function tenantContextMiddleware(req, res, next) {
  const trustedTenant = getTenantId(req);
  req.tenantId = trustedTenant;

  // Prevent request body / query parameter tampering of tenant isolation
  if (req.body && typeof req.body === 'object') {
    if ('institution_id' in req.body && req.body.institution_id !== trustedTenant) {
      // Overwrite spoofed tenant with verified token tenant
      req.body.institution_id = trustedTenant;
    }
  }
  if (req.query && typeof req.query === 'object') {
    if ('institution_id' in req.query && req.query.institution_id !== trustedTenant) {
      req.query.institution_id = trustedTenant;
    }
  }

  next();
}

/**
 * Helper to safely bind tenant isolation to a Supabase query.
 * @param {object} query - Supabase query builder
 * @param {object} req - Express request object
 * @param {string} [columnName='institution_id'] - DB column name
 * @returns {object} Scoped query builder
 */
function scopeQueryToTenant(query, req, columnName = 'institution_id') {
  const tenantId = getTenantId(req);
  return query.eq(columnName, tenantId);
}

module.exports = {
  DEFAULT_TENANT_ID,
  getTenantId,
  tenantContextMiddleware,
  scopeQueryToTenant
};
