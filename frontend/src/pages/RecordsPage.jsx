import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const statusLabel = {
  pending: 'Chờ duyệt',
  manager_approved: 'Quản lý khoa/phòng đã duyệt',
  admin_approved: 'Đã duyệt cuối cùng',
  rejected: 'Bị từ chối',
};

const typeLabel = {
  internal: 'Nội viện',
  external: 'Ngoại viện',
};

const formatDateTimeVN = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
};

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [editingRecordId, setEditingRecordId] = useState('');
  const [resubmitCourseId, setResubmitCourseId] = useState('');
  const [resubmitFile, setResubmitFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const calls = [api.get('/records'), api.get('/records/summary')];
    if (user.role === 'DOCTOR') calls.push(api.get('/courses/eligible/me'));

    const [r, s, c] = await Promise.all(calls);
    setRecords(r.data);
    setSummary(s.data);
    if (c) setCourses(c.data);
  };

  useEffect(() => {
    load();
  }, []);

  const editingRecord = useMemo(
    () => records.find((r) => r._id === editingRecordId) || null,
    [records, editingRecordId]
  );

  const startResubmit = (record) => {
    setEditingRecordId(record._id);
    setResubmitCourseId(record.courseId?._id || '');
    setResubmitFile(null);
    setError('');
    setSuccess('Đang chỉnh sửa hồ sơ bị từ chối để gửi lại.');
  };

  const cancelResubmit = () => {
    setEditingRecordId('');
    setResubmitCourseId('');
    setResubmitFile(null);
  };

  const submitResubmit = async () => {
    setError('');
    setSuccess('');

    if (!editingRecordId) return;
    if (!resubmitCourseId) {
      setError('Vui lòng chọn khóa học hợp lệ để gửi lại.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('courseId', resubmitCourseId);
      if (resubmitFile) formData.append('evidence', resubmitFile);

      await api.patch(`/records/${editingRecordId}/doctor-resubmit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Đã sửa hồ sơ và gửi lại hàng chờ duyệt.');
      cancelResubmit();
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidation = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidation || 'Không thể gửi lại hồ sơ.');
    }
  };

  const deleteRejected = async (id) => {
    const ok = window.confirm('Bạn chắc chắn muốn xóa hồ sơ bị từ chối này?');
    if (!ok) return;

    try {
      await api.delete(`/records/${id}/doctor-delete`);
      setSuccess('Đã xóa hồ sơ bị từ chối.');
      setError('');
      if (editingRecordId === id) cancelResubmit();
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa hồ sơ.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Hồ sơ CME</h1>
        <p>Theo dõi điểm tích lũy, trạng thái duyệt và chứng nhận.</p>
      </div>

      {summary && (
        <div className="metrics-grid">
          <div className="metric-card"><p>Tổng điểm</p><h3>{summary.totalPoints}</h3></div>
          <div className="metric-card"><p>Hồ sơ chờ duyệt</p><h3>{summary.pending}</h3></div>
          <div className="metric-card"><p>Đã được quản lý duyệt</p><h3>{summary.managerApproved}</h3></div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {user.role === 'DOCTOR' && editingRecord && (
        <div className="card">
          <h3>Chỉnh sửa hồ sơ bị từ chối</h3>
          <p className="muted">Lý do từ chối: {editingRecord.note || 'Không có ghi chú'}</p>
          <div className="form-grid">
            <select value={resubmitCourseId} onChange={(e) => setResubmitCourseId(e.target.value)}>
              <option value="">Chọn khóa học khả dụng</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setResubmitFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="row-actions">
            <button className="btn" type="button" onClick={submitResubmit}>Xác nhận gửi lại</button>
            <button className="btn btn-ghost" type="button" onClick={cancelResubmit}>Hủy</button>
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Tiêu đề</th><th>Loại</th><th>Điểm</th><th>Trạng thái</th><th>Nguyên nhân</th><th>Nộp lúc</th><th>Duyệt lúc</th><th>Chứng nhận</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id}>
                <td>{r.title}</td>
                <td>{typeLabel[r.type] || r.type}</td>
                <td>{r.points}</td>
                <td>{statusLabel[r.status] || r.status}</td>
                <td>{r.status === 'rejected' ? (r.note || 'Không có ghi chú') : '-'}</td>
                <td>{formatDateTimeVN(r.createdAt)}</td>
                <td>{r.status === 'admin_approved' ? formatDateTimeVN(r.updatedAt) : '-'}</td>
                <td>
                  {r.certificateFile ? (
                    <a href={`http://localhost:5000/files/certificates/${r.certificateFile}`} target="_blank" rel="noreferrer">Xem</a>
                  ) : '-'}
                </td>
                <td>
                  {user.role === 'DOCTOR' && r.status === 'rejected' && r.type === 'external' ? (
                    <>
                      <button className="btn btn-inline btn-soft" type="button" onClick={() => startResubmit(r)}>Sửa gửi lại</button>
                      <button className="btn btn-inline btn-soft-danger" type="button" onClick={() => deleteRejected(r._id)}>Xóa</button>
                    </>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


