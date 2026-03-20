import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';

const statusLabel = {
  pending: 'Chờ duyệt',
  manager_approved: 'Quản lý đã duyệt',
  admin_approved: 'Đã duyệt cuối cùng',
  rejected: 'Bị từ chối',
};

const formatDateTimeVN = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

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

export default function DepartmentDoctorDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await api.get(`/department-doctors/${id}`);
        if (!mounted) return;
        setData(res.data);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.message || 'Không thể tải chi tiết bác sĩ.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <div className="page">Đang tải chi tiết bác sĩ...</div>;

  if (error) {
    return (
      <div className="page">
        <Link className="btn btn-ghost btn-inline" to="/department-doctors">Quay lại danh sách</Link>
        <p className="error">{error}</p>
      </div>
    );
  }

  const { doctor, summary, recentRecords } = data || {};

  return (
    <div className="page doctor-detail-page">
      <div className="page-head page-head-inline">
        <div>
          <h1>Chi tiết bác sĩ</h1>
          <p>Xem hồ sơ cá nhân và tình trạng CME của bác sĩ trong khoa.</p>
        </div>
        <Link className="btn btn-ghost" to="/department-doctors">Quay lại danh sách</Link>
      </div>

      <div className="profile-grid">
        <section className="card profile-summary-card">
          <p className="chip">Thông tin bác sĩ</p>
          <h2>{doctor?.name || '-'}</h2>
          <p className="profile-summary-role">{doctor?.username || '-'}</p>
          <div className="profile-summary-list">
            <div>
              <span>Vai trò</span>
              <strong>Bác sĩ</strong>
            </div>
            <div>
              <span>Khoa/Phòng</span>
              <strong>{doctor?.departmentId?.name || '-'}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{doctor?.isActive ? 'Đang hoạt động' : 'Đã khóa'}</strong>
            </div>
          </div>
        </section>

        <section className="card profile-form-card">
          <div className="profile-form-grid">
            <div className="profile-field">
              <span>Họ và tên</span>
              <input value={doctor?.name || ''} disabled />
            </div>
            <div className="profile-field">
              <span>Ngày tháng năm sinh</span>
              <input value={formatDateVN(doctor?.birthDate)} disabled />
            </div>
            <div className="profile-field">
              <span>Tên đăng nhập</span>
              <input value={doctor?.username || ''} disabled />
            </div>
            <div className="profile-field">
              <span>CCCD</span>
              <input value={doctor?.cccd || ''} disabled />
            </div>
            <div className="profile-field">
              <span>Số điện thoại</span>
              <input value={doctor?.phone || ''} disabled />
            </div>
            <div className="profile-field">
              <span>Email</span>
              <input value={doctor?.email || ''} disabled />
            </div>
          </div>
        </section>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Tổng điểm CME</p>
          <h3>{summary?.totalPoints || 0}</h3>
        </div>
        <div className="metric-card">
          <p>Tổng hồ sơ</p>
          <h3>{summary?.totalRecords || 0}</h3>
        </div>
        <div className="metric-card">
          <p>Chờ duyệt</p>
          <h3>{summary?.pending || 0}</h3>
        </div>
        <div className="metric-card">
          <p>Đã duyệt cuối cùng</p>
          <h3>{summary?.admin_approved || 0}</h3>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Hồ sơ CME gần đây</h2>
        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TIÊU ĐỀ</th>
                <th>LOẠI</th>
                <th>ĐIỂM</th>
                <th>TRẠNG THÁI</th>
                <th>NGÀY NỘP</th>
              </tr>
            </thead>
            <tbody>
              {(recentRecords || []).map((record) => (
                <tr key={record._id}>
                  <td>{record.title || '-'}</td>
                  <td>{record.type === 'internal' ? 'Nội viện' : 'Ngoại viện'}</td>
                  <td>{record.points || 0}</td>
                  <td>
                    <span className={`status-pill ${record.status === 'rejected' ? 'is-closed' : record.status === 'admin_approved' ? 'is-open' : 'is-submission'}`}>
                      {statusLabel[record.status] || record.status}
                    </span>
                  </td>
                  <td>{formatDateTimeVN(record.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(recentRecords || []).length === 0 && <p className="muted">Bác sĩ này chưa có hồ sơ CME nào.</p>}
        </div>
      </div>
    </div>
  );
}
