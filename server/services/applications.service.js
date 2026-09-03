import { query, queryOne, execute } from '../database/connection.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function getApplications(options = {}) {
  const {
    status,
    page = 1,
    limit = DEFAULT_LIMIT,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = options;

  // Validate and sanitize inputs
  const actualLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (Math.max(1, parseInt(page)) - 1) * actualLimit;

  // Valid sort columns
  const validSortColumns = ['id', 'name', 'phone', 'status', 'created_at', 'updated_at', 'calculated_price'];
  const safeSortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Build WHERE clause
  let where = '';
  const params = [];

  if (status) {
    where += 'status = ? ';
    params.push(status);
  }

  if (search) {
    const searchTerm = `%${search}%`;
    // Clean phone for search: remove spaces, dashes, parentheses
    const phoneClean = `REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '')`;
    if (where) {
      where += `AND (name LIKE ? OR comment LIKE ? OR ${phoneClean} LIKE ?) `;
    } else {
      where += `(name LIKE ? OR comment LIKE ? OR ${phoneClean} LIKE ?) `;
    }
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const finalWhere = where ? 'WHERE ' + where.trim() : '';

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM applications ${finalWhere}`;
  const countResult = await queryOne(countQuery, params);
  const total = countResult ? countResult.total : 0;

  // Get applications
  const queryStr = `
    SELECT id, name, phone, preferred_time, comment, calculator_data,
           calculated_price, status, created_at, updated_at
    FROM applications ${finalWhere}
    ORDER BY ${safeSortColumn} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `;
  const results = await query(queryStr, [...params, actualLimit, offset]);

  // Parse calculator_data from JSON string
  const applications = results.map(app => ({
    ...app,
    calculator_data: app.calculator_data ? JSON.parse(app.calculator_data) : null
  }));

  return {
    applications,
    pagination: {
      page: Math.max(1, parseInt(page)),
      limit: actualLimit,
      totalPages: Math.ceil(total / actualLimit),
      total
    }
  };
}

export async function getApplicationById(id) {
  const app = await queryOne(`
    SELECT id, name, phone, preferred_time, comment, calculator_data,
           calculated_price, status, created_at, updated_at
    FROM applications WHERE id = ?
  `, [id]);

  if (app) {
    return {
      ...app,
      calculator_data: app.calculator_data ? JSON.parse(app.calculator_data) : null
    };
  }
  return null;
}

export async function createApplication(data) {
  const stmt = await execute(`
    INSERT INTO applications
    (name, phone, preferred_time, comment, calculator_data, calculated_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.name,
    data.phone,
    data.preferred_time || null,
    data.comment || null,
    data.calculator_data ? JSON.stringify(data.calculator_data) : null,
    data.calculated_price || null,
    data.status || 'new'
  ]);

  return { id: stmt.lastInsertRowid, ...data };
}

export async function updateApplicationStatus(id, status) {
  const result = await execute(`
    UPDATE applications
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, id]);

  return result.changes > 0;
}

export async function updateApplication(id, data) {
  const fields = [];
  const params = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?');
    params.push(data.phone);
  }
  if (data.preferred_time !== undefined) {
    fields.push('preferred_time = ?');
    params.push(data.preferred_time);
  }
  if (data.comment !== undefined) {
    fields.push('comment = ?');
    params.push(data.comment);
  }
  if (data.calculator_data !== undefined) {
    fields.push('calculator_data = ?');
    params.push(JSON.stringify(data.calculator_data));
  }
  if (data.calculated_price !== undefined) {
    fields.push('calculated_price = ?');
    params.push(data.calculated_price);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
  }

  if (fields.length === 0) {
    return true; // Nothing to update
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const queryStr = `
    UPDATE applications
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  const result = await execute(queryStr, params);
  return result.changes > 0;
}

export async function deleteApplication(id) {
  const result = await execute('DELETE FROM applications WHERE id = ?', [id]);
  return result.changes > 0;
}

export async function getApplicationStats() {
  const stats = await query(`
    SELECT
      status,
      COUNT(*) as count
    FROM applications
    GROUP BY status
  `);

  const totalResult = await queryOne('SELECT COUNT(*) as total FROM applications');
  const total = totalResult ? totalResult.total : 0;

  return {
    total,
    byStatus: Object.fromEntries(stats.map(s => [s.status, s.count]))
  };
}