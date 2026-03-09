import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import CourseFilterBar from '../components/courses/CourseFilterBar';
import CourseTable from '../components/courses/CourseTable';
import CourseModal from '../components/courses/CourseModal';
import Pagination from '../components/courses/Pagination';

const initialFilters = {
  page: 1,
  limit: 10,
  year: '',
  status: 'all',
  department: 'all',
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export default function CoursesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value === '' || value === undefined || value === null) return;
        params.append(key, value);
      });

      const [courseRes, deptRes] = await Promise.all([
        api.get(`/courses?${params.toString()}`),
        api.get('/departments'),
      ]);

      setCourses(courseRes.data.data || []);
      setPagination(courseRes.data.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
      setDepartments(deptRes.data || []);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
  }, [filters]);

  const years = useMemo(() => {
    const set = new Set();
    courses.forEach((c) => {
      if (c.startDate) set.add(new Date(c.startDate).getFullYear());
    });
    const nowYear = new Date().getFullYear();
    [nowYear - 1, nowYear, nowYear + 1, nowYear + 2].forEach((y) => set.add(y));
    return [...set].sort((a, b) => b - a);
  }, [courses]);

  const openCreate = () => {
    setEditingCourse(null);
    setModalOpen(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setModalOpen(true);
  };

  const onSaveCourse = async (payload) => {
    setError('');
    setMessage('');
    try {
      if (editingCourse) {
        await api.patch(`/courses/${editingCourse._id}`, payload);
        setMessage('Cập nhật khóa học thành công.');
      } else {
        await api.post('/courses', payload);
        setMessage('Tạo khóa học thành công.');
      }
      setModalOpen(false);
      setEditingCourse(null);
      load(filters);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidation = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidation || 'Không thể lưu khóa học.');
    }
  };

  const onDelete = async (id) => {
    const ok = window.confirm('Bạn chắc chắn muốn xóa khóa học này?');
    if (!ok) return;

    try {
      await api.delete(`/courses/${id}`);
      setMessage('Xóa khóa học thành công.');
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      load(filters);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa khóa học.');
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Xóa ${selectedIds.length} khóa học đã chọn?`);
    if (!ok) return;

    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/courses/${id}`)));
      setMessage('Đã xóa các khóa học đã chọn.');
      setSelectedIds([]);
      load(filters);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa nhiều khóa học.');
    }
  };

  const onToggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onToggleAll = (checked) => {
    if (checked) setSelectedIds(courses.map((c) => c._id));
    else setSelectedIds([]);
  };

  const onSort = (field) => {
    setFilters((prev) => {
      if (prev.sortBy === field) {
        return { ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...prev, sortBy: field, sortOrder: 'asc', page: 1 };
    });
  };

  return (
    <div className="page">
      <div className="page-head page-head-inline">
        <div>
          <h1>Quản lý khóa học</h1>
          <p>Danh sách khóa học CME theo chuẩn dashboard quản trị bệnh viện.</p>
        </div>
        <button className="btn" type="button" onClick={openCreate}>+ Tạo khóa học</button>
      </div>

      <CourseFilterBar
        filters={filters}
        years={years}
        departments={departments}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(initialFilters)}
      />

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {selectedIds.length > 0 && (
        <div className="card bulk-bar">
          <p className="muted">Đã chọn {selectedIds.length} khóa học</p>
          <button className="btn btn-soft-danger" type="button" onClick={deleteSelected}>Xóa đã chọn</button>
        </div>
      )}

      <CourseTable
        courses={courses}
        selectedIds={selectedIds}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
        onEdit={openEdit}
        onDelete={onDelete}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={onSort}
      />

      <div className="pagination-meta muted">
        {loading ? 'Đang tải...' : `Tổng ${pagination.total} khóa học`}
      </div>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
      />

      <CourseModal
        open={modalOpen}
        course={editingCourse}
        departments={departments}
        onClose={() => {
          setModalOpen(false);
          setEditingCourse(null);
        }}
        onSubmit={onSaveCourse}
        loading={loading}
      />
    </div>
  );
}
