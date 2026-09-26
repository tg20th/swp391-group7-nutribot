import { apiRequest, unwrapData } from './apiClient';

const itemsFrom = (payload) => {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (data?.items) return data.items;
  return [];
};

export async function searchContent({ keyword, categoryId, contentType, page = 0, size = 12, signal }) {
  const params = new URLSearchParams();
  if (keyword?.trim()) params.append('keyword', keyword.trim());
  if (categoryId) params.append('categoryId', categoryId);
  if (contentType && contentType !== 'All') params.append('contentType', contentType);
  params.append('page', page);
  params.append('size', size);

  const queryString = params.toString();
  const path = `/api/v1/search${queryString ? `?${queryString}` : ''}`;
  const payload = await apiRequest(path, { signal });

  const items = itemsFrom(payload);
  const meta = {
    totalElements: payload?.totalElements ?? payload?.total ?? items.length,
    totalPages: payload?.totalPages ?? 1,
    page: payload?.number ?? page,
    size: payload?.size ?? size
  };

  return { items, meta };
}

export async function getCategories(signal) {
  const payload = await apiRequest('/api/v1/categories', { signal });
  return itemsFrom(payload);
}
