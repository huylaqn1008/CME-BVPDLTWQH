export default function CourseFilterBar({ filters, years, departments, onChange, onReset }) {
  return (
    <div className="course-filter-bar card">
      <select value={filters.year} onChange={(e) => onChange({ year: e.target.value, page: 1 })}>
        <option value="">Tất cả năm</option>
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>

      <select value={filters.status} onChange={(e) => onChange({ status: e.target.value, page: 1 })}>
        <option value="all">Tất cả trạng thái</option>
        <option value="OPEN">Đang mở</option>
        <option value="UPCOMING">Sắp mở</option>
        <option value="ENDED">Đã đóng</option>
      </select>

      <select value={filters.department} onChange={(e) => onChange({ department: e.target.value, page: 1 })}>
        <option value="all">Tất cả khoa/phòng</option>
        {departments.map((d) => (
          <option key={d._id} value={d._id}>{d.name}</option>
        ))}
      </select>

      <input
        placeholder="Tìm tên khóa học..."
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value, page: 1 })}
      />

      <button className="btn btn-ghost" type="button" onClick={onReset}>Reset</button>
    </div>
  );
}
