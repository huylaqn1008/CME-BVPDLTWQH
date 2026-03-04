import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const statusLabel = {
  OPEN: 'Đang mở',
  SUBMISSION_OPEN: 'Cho phép nộp',
  CLOSED: 'Đã đóng',
};

const statusTone = {
  OPEN: 'is-open',
  SUBMISSION_OPEN: 'is-submission',
  CLOSED: 'is-closed',
};

const emptyForm = {
  title: '',
  description: '',
  cmePoints: 1,
  submissionStatus: 'OPEN',
  applicableDepartments: [],
  startDate: '',
  endDate: '',
};

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [courseRes, deptRes] = await Promise.all([api.get('/courses'), api.get('/departments')]);
    setCourses(courseRes.data);
    setDepartments(deptRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedDept = useMemo(() => {
    const set = new Set(form.applicableDepartments);
    return departments.filter((d) => set.has(d._id));
  }, [departments, form.applicableDepartments]);

  const filteredDepartments = useMemo(() => {
    const kw = deptSearch.trim().toLowerCase();
    if (!kw) return departments.slice(0, 8);
    return departments.filter((d) => d.name.toLowerCase().includes(kw)).slice(0, 8);
  }, [departments, deptSearch]);

  const isSelected = (departmentId) => form.applicableDepartments.includes(departmentId);

  const addDepartment = (departmentId) => {
    if (isSelected(departmentId)) return;
    setForm((prev) => ({ ...prev, applicableDepartments: [...prev.applicableDepartments, departmentId] }));
  };

  const removeDepartment = (departmentId) => {
    setForm((prev) => ({
      ...prev,
      applicableDepartments: prev.applicableDepartments.filter((id) => id !== departmentId),
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId('');
    setDeptSearch('');
  };

  const onEdit = (course) => {
    setEditingId(course._id);
    setForm({
      title: course.title || '',
      description: course.description || '',
      cmePoints: Number(course.cmePoints || 0),
      submissionStatus: course.submissionStatus || 'OPEN',
      applicableDepartments: Array.isArray(course.applicableDepartments)
        ? course.applicableDepartments.map((d) => (typeof d === 'string' ? d : d._id))
        : [],
      startDate: toDateInput(course.startDate),
      endDate: toDateInput(course.endDate),
    });
    setDeptSearch('');
    setMessage('Đang chỉnh sửa khóa học.');
    setError('');
  };

  const onDelete = async (courseId) => {
    const ok = window.confirm('Bạn chắc chắn muốn xóa khóa học này?');
    if (!ok) return;

    try {
      await api.delete(`/courses/${courseId}`);
      if (editingId === courseId) resetForm();
      setMessage('Xóa khóa học thành công.');
      setError('');
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa khóa học');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await api.patch(`/courses/${editingId}`, form);
        setMessage('Cập nhật khóa học thành công.');
      } else {
        await api.post('/courses', form);
        setMessage('Tạo khóa học thành công.');
      }
      resetForm();
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidation = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidation || 'Không thể lưu khóa học');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Quản lý khóa học</h1>
        <p>Thiết lập khóa học, điểm CME và phạm vi theo khoa/phòng.</p>
      </div>

      <form className="card course-form" onSubmit={submit}>
        <div className="course-grid">
          <input placeholder="Tên khóa học" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Mô tả ngắn" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input type="number" min="0" value={form.cmePoints} onChange={(e) => setForm({ ...form, cmePoints: Number(e.target.value) })} />
          <select value={form.submissionStatus} onChange={(e) => setForm({ ...form, submissionStatus: e.target.value })}>
            <option value="OPEN">Đang mở</option>
            <option value="SUBMISSION_OPEN">Cho phép nộp</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>

        <div className="course-scope">
          <p className="muted">Khoa áp dụng (bỏ trống = toàn bệnh viện)</p>

          <input
            placeholder="Tìm khoa/phòng để thêm"
            value={deptSearch}
            onChange={(e) => setDeptSearch(e.target.value)}
          />

          {deptSearch && (
            <div className="dept-results">
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map((d) => (
                  <button
                    key={d._id}
                    type="button"
                    className="btn btn-ghost btn-inline"
                    onClick={() => addDepartment(d._id)}
                    disabled={isSelected(d._id)}
                  >
                    {d.name}
                  </button>
                ))
              ) : (
                <p className="muted">Không có khoa/phòng phù hợp</p>
              )}
            </div>
          )}

          <div className="dept-chips">
            {selectedDept.map((d) => (
              <button key={d._id} type="button" className="dept-chip" onClick={() => removeDepartment(d._id)}>
                {d.name} x
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <div className="row-actions">
          <button className="btn" type="submit">{editingId ? 'Lưu cập nhật' : 'Tạo khóa học'}</button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Hủy chỉnh sửa
            </button>
          )}
        </div>
      </form>

      <div className="course-cards">
        {courses.map((c) => (
          <div key={c._id} className="metric-card course-card">
            <div className="course-card-top">
              <h3>{c.title}</h3>
              <span className={`status-pill ${statusTone[c.submissionStatus] || 'is-open'}`}>
                {statusLabel[c.submissionStatus] || c.submissionStatus || 'Đang mở'}
              </span>
            </div>

            <div className="course-points">{c.cmePoints} điểm CME</div>
            <p className="course-desc">{c.description || 'Không có mô tả'}</p>
            <p className="course-scope-text">
              {Array.isArray(c.applicableDepartments) && c.applicableDepartments.length > 0
                ? c.applicableDepartments.map((d) => d.name).join(', ')
                : 'Toàn bệnh viện'}
            </p>

            <div className="course-actions">
              <button className="btn btn-soft" type="button" onClick={() => onEdit(c)}>Sửa</button>
              <button className="btn btn-soft-danger" type="button" onClick={() => onDelete(c._id)}>Xóa</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
