import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatDateVN = (value) => {
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

export default function DepartmentDoctorsPage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState({ departmentName: '', totalDoctors: 0, activeDoctors: 0, doctors: [] });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await api.get('/department-doctors');
        if (!mounted) return;
        setPayload(res.data || { departmentName: '', totalDoctors: 0, activeDoctors: 0, doctors: [] });
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.message || 'Không thể tải danh sách bác sĩ trong khoa.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredDoctors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload.doctors || []).filter((doctor) => {
      const hay = `${doctor.name || ''} ${doctor.username || ''} ${doctor.cccd || ''} ${doctor.phone || ''} ${doctor.email || ''}`.toLowerCase();
      const matchQuery = !needle || hay.includes(needle);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && doctor.isActive) ||
        (statusFilter === 'inactive' && !doctor.isActive);
      return matchQuery && matchStatus;
    });
  }, [payload.doctors, query, statusFilter]);

  if (loading) return <div className="page">Đang tải danh sách bác sĩ...</div>;

  return (
    <div className="page doctor-page">
      <div className="page-head page-head-inline">
        <div>
          <h1>Bác sĩ trong khoa</h1>
          <p>Danh sách chỉ gồm bác sĩ thuộc khoa/phòng của bạn. Có thể xem chi tiết nhưng không được chỉnh sửa.</p>
        </div>
        <div className="chip">Khoa: {payload.departmentName || user?.departmentId?.name || '-'}</div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Tổng bác sĩ</p>
          <h3>{payload.totalDoctors}</h3>
        </div>
        <div className="metric-card">
          <p>Đang hoạt động</p>
          <h3>{payload.activeDoctors}</h3>
        </div>
        <div className="metric-card">
          <p>Đang hiển thị</p>
          <h3>{filteredDoctors.length}</h3>
        </div>
      </div>

      <div className="card">
        <div className="doctor-list-header">
          <div className="doctor-list-title">
            <h2 className="section-title">Danh sách bác sĩ</h2>
            <div className="doctor-filter-row">
              <input
                className="doctor-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kiếm..."
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã khóa</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>HỌ TÊN</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>NGÀY SINH</th>
                <th>CCCD</th>
                <th>SỐ ĐIỆN THOẠI</th>
                <th>EMAIL</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doctor) => (
                <tr key={doctor._id}>
                  <td>{doctor.name || '-'}</td>
                  <td>{doctor.username || '-'}</td>
                  <td>{formatDateVN(doctor.birthDate)}</td>
                  <td>{doctor.cccd || '-'}</td>
                  <td>{doctor.phone || '-'}</td>
                  <td>{doctor.email || '-'}</td>
                  <td>
                    <span className={`status-pill ${doctor.isActive ? 'is-open' : 'is-closed'}`}>
                      {doctor.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-inline btn-soft" to={`/department-doctors/${doctor._id}`}>
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDoctors.length === 0 && <p className="muted">Không có bác sĩ nào khớp với điều kiện tìm kiếm.</p>}
        </div>
      </div>
    </div>
  );
}
