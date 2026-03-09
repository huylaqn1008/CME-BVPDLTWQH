import { useEffect, useMemo, useState } from 'react';

const emptyForm = {
  title: '',
  description: '',
  cmePoints: 1,
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

export default function CourseModal({ open, course, departments, onClose, onSubmit, loading }) {
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [applyAll, setApplyAll] = useState(true);

  useEffect(() => {
    if (!course) {
      setForm(emptyForm);
      setSearch('');
      setApplyAll(true);
      return;
    }

    const deptIds = Array.isArray(course.applicableDepartments)
      ? course.applicableDepartments.map((d) => (typeof d === 'string' ? d : d._id))
      : [];

    setForm({
      title: course.title || '',
      description: course.description || '',
      cmePoints: Number(course.cmePoints || 0),
      applicableDepartments: deptIds,
      startDate: toDateInput(course.startDate),
      endDate: toDateInput(course.endDate),
    });
    setApplyAll(deptIds.length === 0);
    setSearch('');
  }, [course]);

  const filteredDepartments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(keyword));
  }, [departments, search]);

  const timelineStatusLabel = useMemo(() => {
    const now = new Date();
    const start = form.startDate ? new Date(`${form.startDate}T00:00:00`) : null;
    const end = form.endDate ? new Date(`${form.endDate}T23:59:59`) : null;

    if (start && now < start) return 'Sắp mở';
    if (end && now > end) return 'Đã đóng';
    return 'Đang mở';
  }, [form.startDate, form.endDate]);

  const toggleDepartment = (departmentId) => {
    setForm((prev) => {
      const exists = prev.applicableDepartments.includes(departmentId);
      return {
        ...prev,
        applicableDepartments: exists
          ? prev.applicableDepartments.filter((id) => id !== departmentId)
          : [...prev.applicableDepartments, departmentId],
      };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      applicableDepartments: applyAll ? [] : form.applicableDepartments,
    };
    onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-header">
          <h3>{course ? 'Chỉnh sửa khóa học' : 'Tạo khóa học'}</h3>
          <p>{course ? 'Cập nhật thông tin khóa học CME' : 'Tạo mới khóa học CME cho hệ thống'}</p>
        </div>

        <section className="modal-section">
          <h4>Thông tin khóa học</h4>
          <div className="modal-grid single-col">
            <input
              placeholder="Tên khóa học"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              placeholder="Mô tả khóa học"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="modal-grid two-col">
            <input
              type="number"
              min="0"
              value={form.cmePoints}
              onChange={(e) => setForm({ ...form, cmePoints: Number(e.target.value) })}
              required
            />
            <input value={timelineStatusLabel} disabled readOnly />
          </div>
        </section>

        <section className="modal-section">
          <h4>Thời gian khóa học</h4>
          <div className="modal-grid two-col">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </section>

        <section className="modal-section">
          <div className="modal-section-head">
            <h4>Khoa áp dụng</h4>
            <label className="apply-all-toggle">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
              />
              <span>Áp dụng cho toàn bệnh viện</span>
            </label>
          </div>

          {!applyAll && (
            <>
              <input
                placeholder="Tìm khoa/phòng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="department-grid">
                {filteredDepartments.map((d) => {
                  const checked = form.applicableDepartments.includes(d._id);
                  return (
                    <label key={d._id} className={`dept-card ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDepartment(d._id)}
                      />
                      <span>{d.name}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Hủy</button>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Đang lưu...' : (course ? 'Lưu cập nhật' : 'Tạo khóa học')}</button>
        </div>
      </form>
    </div>
  );
}
