import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoaderCircle, Search, SlidersHorizontal, X, Bookmark, Play, Eye } from 'lucide-react';
import { searchContent, getCategories } from '../services/searchApi';
import '../styles/search.css';

const CONTENT_TYPES = ['All', 'BLOG', 'VIDEO'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'oldest', label: 'Cũ nhất' }
];

function ContentCard({ item, index }) {
  const isVideo = item.type === 'VIDEO' || item.contentType === 'VIDEO';
  const thumbnail = item.thumbnailUrl || item.imageUrl || item.image;
  const title = item.title;
  const author = item.authorName || item.author?.fullName || 'NutriBot';
  const views = item.viewCount || item.views || 0;
  const createdAt = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <article
      className="search-result-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <a href={`/community/posts/${item.contentId || item.id}`} className="search-result-media">
        {thumbnail ? (
          <img src={thumbnail} alt={title} loading="lazy" />
        ) : (
          <div className="search-result-placeholder">
            <span>{isVideo ? 'VIDEO' : 'BLOG'}</span>
          </div>
        )}
        {isVideo && (
          <div className="search-result-play">
            <Play size={18} fill="currentColor" />
          </div>
        )}
        <span className="search-result-type-badge">
          {isVideo ? 'Video' : 'Blog'}
        </span>
      </a>
      <div className="search-result-content">
        <a href={`/community/posts/${item.contentId || item.id}`} className="search-result-title">
          <h3>{title}</h3>
        </a>
        <div className="search-result-meta">
          <span className="search-result-author">{author}</span>
          <span className="search-result-dot">·</span>
          <span className="search-result-views">
            <Eye size={12} />
            {views.toLocaleString()}
          </span>
          <span className="search-result-dot">·</span>
          <span className="search-result-date">{createdAt}</span>
        </div>
        <div className="search-result-actions">
          <button className="search-save-btn" aria-label="Lưu bài viết">
            <Bookmark size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`filter-chip ${active ? 'filter-chip--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SearchFilters({ categories, filters, onFilterChange }) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, 6);

  return (
    <div className="search-filters">
      <div className="filter-section">
        <h4 className="filter-label">Loại nội dung</h4>
        <div className="filter-chips">
          {CONTENT_TYPES.map((type) => (
            <FilterChip
              key={type}
              label={type === 'All' ? 'Tất cả' : type === 'BLOG' ? 'Bài viết' : 'Video'}
              active={filters.contentType === type || (type === 'All' && !filters.contentType)}
              onClick={() => onFilterChange('contentType', type === 'All' ? '' : type)}
            />
          ))}
        </div>
      </div>

      <div className="filter-section">
        <h4 className="filter-label">Danh mục</h4>
        <div className="filter-chips filter-chips--wrap">
          <FilterChip
            label="Tất cả"
            active={!filters.categoryId}
            onClick={() => onFilterChange('categoryId', '')}
          />
          {visibleCategories.map((cat) => (
            <FilterChip
              key={cat.categoryId || cat.id}
              label={cat.name}
              active={filters.categoryId === (cat.categoryId || cat.id)}
              onClick={() => onFilterChange('categoryId', cat.categoryId || cat.id)}
            />
          ))}
        </div>
        {categories.length > 6 && (
          <button
            type="button"
            className="filter-show-more"
            onClick={() => setShowAllCategories(!showAllCategories)}
          >
            {showAllCategories ? 'Thu gọn' : `Xem thêm ${categories.length - 6} danh mục`}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ keyword }) {
  return (
    <div className="search-empty">
      <div className="search-empty-icon">
        <Search size={48} strokeWidth={1} />
      </div>
      <h3>Không tìm thấy kết quả</h3>
      <p>
        {keyword
          ? `Không có nội dung nào phù hợp với "${keyword}"`
          : 'Thử thay đổi từ khóa hoặc bộ lọc để tìm kiếm'}
      </p>
      <div className="search-empty-suggestions">
        <span>Gợi ý:</span>
        <button type="button">Công thức healthy</button>
        <button type="button">Món chay</button>
        <button type="button">Giảm cân</button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="search-loading">
      <LoaderCircle size={32} className="search-spinner" />
      <p>Đang tìm kiếm...</p>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ totalElements: 0, totalPages: 1, page: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [localKeyword, setLocalKeyword] = useState(searchParams.get('q') || '');

  const filters = {
    contentType: searchParams.get('type') || '',
    categoryId: searchParams.get('category') || ''
  };

  const pageRef = useRef(0);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Fetch categories
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch results
  const fetchResults = useCallback(async (page = 0, append = false) => {
    const keyword = searchParams.get('q') || '';
    const contentType = filters.contentType || undefined;
    const categoryId = filters.categoryId ? parseInt(filters.categoryId) : undefined;

    if (page === 0) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const data = await searchContent({
        keyword,
        contentType,
        categoryId,
        page,
        size: 12
      });

      const normalized = data.items.map((item) => ({
        ...item,
        id: item.contentId || item.id,
        type: item.contentType || item.type,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl || item.imageUrl || item.image,
        authorName: item.authorName || item.author?.fullName || 'NutriBot',
        viewCount: item.viewCount || item.views || 0,
        createdAt: item.createdAt || item.created_at
      }));

      if (append) {
        setResults((prev) => [...prev, ...normalized]);
      } else {
        setResults(normalized);
      }
      setMeta(data.meta);
      pageRef.current = page;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Không thể tải kết quả tìm kiếm. Vui lòng thử lại.');
        setResults([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchParams, filters.contentType, filters.categoryId]);

  // Initial fetch
  useEffect(() => {
    fetchResults(0, false);
  }, [fetchResults]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (loading || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pageRef.current < meta.totalPages - 1) {
          fetchResults(pageRef.current + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, loadingMore, meta.totalPages, fetchResults]);

  const handleKeywordSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (localKeyword.trim()) {
      newParams.set('q', localKeyword.trim());
    } else {
      newParams.delete('q');
    }
    newParams.set('page', '0');
    setSearchParams(newParams);
  };

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      if (key === 'contentType') {
        newParams.set('type', value);
      } else {
        newParams.set('category', value);
      }
    } else {
      if (key === 'contentType') {
        newParams.delete('type');
      } else {
        newParams.delete('category');
      }
    }
    newParams.set('page', '0');
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setLocalKeyword('');
  };

  const hasActiveFilters = searchParams.get('q') || filters.contentType || filters.categoryId;
  const keyword = searchParams.get('q') || '';

  return (
    <div className="search-page">
      {/* Search Header */}
      <header className="search-header">
        <div className="search-header-inner">
          <form className="search-form" onSubmit={handleKeywordSubmit}>
            <div className="search-input-wrap">
              <Search size={20} className="search-input-icon" />
              <input
                type="text"
                value={localKeyword}
                onChange={(e) => setLocalKeyword(e.target.value)}
                placeholder="Tìm kiếm bài viết, video, công thức..."
                className="search-input"
                aria-label="Từ khóa tìm kiếm"
              />
              {localKeyword && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => { setLocalKeyword(''); handleFilterChange('keyword', ''); }}
                  aria-label="Xóa từ khóa"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button type="submit" className="search-submit-btn">
              Tìm kiếm
            </button>
          </form>

          <div className="search-header-actions">
            <button
              type="button"
              className={`search-filter-toggle ${showFilters ? 'search-filter-toggle--active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={18} />
              Bộ lọc
              {(filters.contentType || filters.categoryId) && (
                <span className="filter-badge">•</span>
              )}
            </button>

            {hasActiveFilters && (
              <button type="button" className="search-clear-filters" onClick={clearAllFilters}>
                <X size={14} />
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="search-filters-panel">
            <SearchFilters
              categories={categories}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}
      </header>

      {/* Results Section */}
      <main className="search-results-section">
        <div className="search-results-header">
          <div className="search-results-info">
            {keyword ? (
              <h2>
                Kết quả cho <span className="search-keyword">"{keyword}"</span>
              </h2>
            ) : (
              <h2>Tất cả nội dung</h2>
            )}
            {!loading && (
              <p className="search-results-count">
                {meta.totalElements.toLocaleString()} kết quả
              </p>
            )}
          </div>

          <div className="search-sort">
            <label htmlFor="sort-select" className="search-sort-label">Sắp xếp:</label>
            <select id="sort-select" className="search-sort-select">
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Pills */}
        {hasActiveFilters && (
          <div className="search-active-filters">
            {keyword && (
              <span className="active-filter-pill">
                "{keyword}"
                <button onClick={() => { setLocalKeyword(''); setSearchParams({}); }}>
                  <X size={12} />
                </button>
              </span>
            )}
            {filters.contentType && (
              <span className="active-filter-pill">
                {filters.contentType === 'BLOG' ? 'Bài viết' : 'Video'}
                <button onClick={() => handleFilterChange('contentType', '')}>
                  <X size={12} />
                </button>
              </span>
            )}
            {filters.categoryId && (
              <span className="active-filter-pill">
                {categories.find((c) => (c.categoryId || c.id) === parseInt(filters.categoryId))?.name || 'Danh mục'}
                <button onClick={() => handleFilterChange('categoryId', '')}>
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="search-error">
            <p>{error}</p>
            <button onClick={() => fetchResults(0)}>Thử lại</button>
          </div>
        ) : results.length === 0 ? (
          <EmptyState keyword={keyword} />
        ) : (
          <>
            <div className="search-results-grid">
              {results.map((item, index) => (
                <ContentCard key={item.id || index} item={item} index={index} />
              ))}
            </div>

            {/* Load More Trigger */}
            {pageRef.current < meta.totalPages - 1 && (
              <div ref={loadMoreRef} className="search-load-more">
                {loadingMore ? (
                  <LoaderCircle size={24} className="search-spinner" />
                ) : (
                  <button
                    className="load-more-btn"
                    onClick={() => fetchResults(pageRef.current + 1, true)}
                  >
                    Xem thêm kết quả
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
