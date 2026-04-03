import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/courses/Pagination';
import { useAuth } from '../context/AuthContext';

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'UPCOMING', label: 'Sắp mở' },
  { value: 'ENDED', label: 'Đã đóng' },
];

const statusClass = {
  OPEN: 'status-pill is-open',
  UPCOMING: 'status-pill is-submission',
  ENDED: 'status-pill is-closed',
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatDepartment = (departments) => {
  if (!Array.isArray(departments) || departments.length === 0) return 'Toàn bệnh viện';
  const names = departments.map((item) => item.name).filter(Boolean);
  if (names.length === 0) return 'Toàn bệnh viện';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} khoa khác`;
};

export default function MyCoursesPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 8,
    search: '',
    status: 'all',
  });
  const [payload, setPayload] = useState({
    data: [],
    summary: { total: 0, open: 0, upcoming: 0, ended: 0 },
    pagination: { page: 1, totalPages: 1, total: 0, limit: 8 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value === '' || value === undefined || value === null) return;
        params.append(key, value);
      });
      const res = await api.get(`/courses/my?${params.toString()}`);
      setPayload(
        res.data || {
          data: [],
          summary: { total: 0, open: 0, upcoming: 0, ended: 0 },
          pagination: { page: 1, totalPages: 1, total: 0, limit: 8 },
        }
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [filters.search, filters.status, filters.limit]);

  const summaryCards = useMemo(
    () => [
      { label: 'Tổng khóa', value: payload.summary.total },
      { label: 'Đang mở', value: payload.summary.open },
      { label: 'Sắp mở', value: payload.summary.upcoming },
      { label: 'Đã đóng', value: payload.summary.ended },
    ],
    [payload.summary]
  );

  const departmentLabel = user?.departmentId?.name || user?.departmentId || 'Toàn hệ thống';

  return (
    <div className="page my-courses-page">
      <div className="page-head page-head-inline">
        <div>
          <h1>Khóa học của tôi</h1>
          <p>Khóa học dành cho khoa/phòng của bạn. Khóa sắp mở vẫn hiển thị để bạn theo dõi trước lịch.</p>
        </div>
        <div className="chip">Khoa/Phòng: {departmentLabel}</div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="metrics-grid my-courses-summary">
        {summaryCards.map((item) => (
          <div className="metric-card" key={item.label}>
            <p>{item.label}</p>
            <h3>{loading ? '...' : item.value}</h3>
          </div>
        ))}
      </div>

      <div className="card my-courses-toolbar">
        <div>
          <h2 className="section-title">Bộ lọc khóa học</h2>
          <p className="muted">Tìm theo tên khóa học, lọc theo trạng thái và số lượng hiển thị trên mỗi trang.</p>
        </div>
        <div className="my-courses-toolbar-actions">
          <input
            type="search"
            placeholder="Tìm khóa học..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.limit}
            onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
          >
            {[8, 16, 32].map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card my-courses-guide">
        <div className="alert-card">
          <p className="alert-title">Cách dùng nhanh</p>
          <p className="alert-text">Bấm vào thông báo "Mở" để đi thẳng đến danh sách này. Khóa "Đang mở" có thể nộp minh chứng ngay, còn khóa "Sắp mở" giúp bạn biết lịch trước.</p>
        </div>
      </div>

      {loading ? (
        <div className="card my-courses-loading">Đang tải khóa học...</div>
      ) : (
        <div className="my-course-grid">
          {payload.data.map((course) => {
            const departmentText = formatDepartment(course.applicableDepartments);
            return (
              <article key={course._id} className="card my-course-card">
                <div className="my-course-card-head">
                  <div>
                    <h3>{course.title}</h3>
                    <p>{course.description || 'Không có mô tả'}</p>
                  </div>
                  <span className={statusClass[course.timelineStatus] || 'status-pill is-open'}>
                    {course.timelineStatusLabel || 'Đang mở'}
                  </span>
                </div>

                <div className="my-course-meta">
                  <span>{course.cmePoints} điểm CME</span>
                  <span>{departmentText}</span>
                  <span>{formatDate(course.startDate)} → {formatDate(course.endDate)}</span>
                </div>

                <div className="my-course-footer">
                  <div className="chip chip-soft">
                    {course.timelineStatus === 'OPEN'
                      ? 'Có thể nộp minh chứng'
                      : course.timelineStatus === 'UPCOMING'
                        ? 'Chuẩn bị mở'
                        : 'Đã kết thúc'}
                  </div>

                  <div className="my-course-actions">
                    {course.timelineStatus === 'OPEN' && (
                      <Link className="btn btn-inline btn-soft" to="/upload">
                        Nộp minh chứng
                      </Link>
                    )}
                    {course.timelineStatus === 'UPCOMING' && (
                      <span className="notification-read-label">Theo dõi lịch mở</span>
                    )}
                    {course.timelineStatus === 'ENDED' && (
                      <span className="notification-read-label">Không còn hiệu lực</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {payload.data.length === 0 && (
            <div className="card my-courses-empty">
              <h3>Chưa có khóa học nào phù hợp</h3>
              <p>Hãy kiểm tra lại bộ lọc hoặc chờ admin/khoa tạo thêm khóa học mới.</p>
            </div>
          )}
        </div>
      )}

      <div className="pagination-meta muted">
        {loading ? 'Đang tải...' : `Tổng ${payload.pagination.total} khóa học`}
      </div>

      <Pagination
        page={payload.pagination.page}
        totalPages={payload.pagination.totalPages}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
      />
    </div>
  );
}
