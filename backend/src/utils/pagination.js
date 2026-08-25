const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Parses ?page=&limit= with sane bounds. Returns { skip, take, page, limit } */
function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
  limit = Math.min(MAX_PAGE_SIZE, Math.max(1, limit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

const buildMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { parsePagination, buildMeta };
