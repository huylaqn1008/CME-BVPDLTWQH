import { useState } from 'react';

const statusClass = {
  OPEN: 'status-pill is-open',
  UPCOMING: 'status-pill is-submission',
  ENDED: 'status-pill is-closed',
};

const statusLabel = {
  OPEN: 'Đang mở',
  UPCOMING: 'Sắp mở',
  ENDED: 'Đã kết thúc',
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('vi-VN');
};

const formatDepartment = (departments) => {
  if (!Array.isArray(departments) || departments.length === 0) return 'Toàn bệnh viện';
  const names = departments.map((d) => d.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} khoa khác`;
};

const fullDepartmentText = (departments) => {
  if (!Array.isArray(departments) || departments.length === 0) return 'Toàn bệnh viện';
  return departments.map((d) => d.name).join(', ');
};

export default function CourseTable({
  courses,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}) {
  const allSelected = courses.length > 0 && courses.every((c) => selectedIds.includes(c._id));
  const [expandedDepartments, setExpandedDepartments] = useState({});

  const toggleDepartmentExpand = (courseId) => {
    setExpandedDepartments((prev) => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  return (
    <div className="card table-shell">
      <table className="admin-table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} /></th>
            <th>
              <button className="th-sort" type="button" onClick={() => onSort('title')}>
                Tên khóa học {sortBy === 'title' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            </th>
            <th>Điểm CME</th>
            <th>
              <button className="th-sort" type="button" onClick={() => onSort('startDate')}>
                Thời gian {sortBy === 'startDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            </th>
            <th>Khoa áp dụng</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course._id} className="course-row">
              <td><input type="checkbox" checked={selectedIds.includes(course._id)} onChange={() => onToggle(course._id)} /></td>
              <td className="course-name-cell">
                <div className="course-name-title">📘 {course.title}</div>
                <div className="course-name-sub">{course.description || 'Không có mô tả'}</div>
              </td>
              <td>{course.cmePoints}</td>
              <td className="course-time-cell">
                <div>{formatDate(course.startDate)}</div>
                <div className="course-time-arrow">→</div>
                <div>{formatDate(course.endDate)}</div>
              </td>
              <td title={fullDepartmentText(course.applicableDepartments)}>
                {expandedDepartments[course._id]
                  ? fullDepartmentText(course.applicableDepartments)
                  : formatDepartment(course.applicableDepartments)}
                {Array.isArray(course.applicableDepartments) && course.applicableDepartments.length > 2 && (
                  <button
                    type="button"
                    className="dept-expand-btn"
                    onClick={() => toggleDepartmentExpand(course._id)}
                  >
                    {expandedDepartments[course._id] ? 'Thu gọn' : 'Xem đầy đủ'}
                  </button>
                )}
              </td>
              <td>
                <span className={statusClass[course.timelineStatus] || 'status-pill is-open'}>
                  {statusLabel[course.timelineStatus] || 'Đang mở'}
                </span>
              </td>
              <td className="action-cell">
                <button className="icon-btn edit-btn" type="button" onClick={() => onEdit(course)} title="Sửa khóa học">✏️</button>
                <button className="icon-btn delete-btn" type="button" onClick={() => onDelete(course._id)} title="Xóa khóa học">🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
