import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const statusLabel = {
  pending: 'Chờ quản lý khoa/phòng duyệt',
  manager_approved: 'Đã được quản lý khoa/phòng duyệt',
  admin_approved: 'Đã duyệt cuối cùng',
  rejected: 'Bị từ chối',
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

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [noteByRecord, setNoteByRecord] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const res = await api.get('/records/approval-queue');
    setRecords(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const queueHint = useMemo(() => {
    if (user.role === 'MANAGER') return 'Bạn chỉ thấy hồ sơ chờ duyệt của bác sĩ trong khoa/phòng của mình.';
    return 'Bạn chỉ thấy hồ sơ đã được quản lý khoa/phòng duyệt.';
  }, [user.role]);

  const review = async (id, status) => {
    setError('');
    setSuccess('');

    const note = (noteByRecord[id] || '').trim();
    if (note.length < 5) {
      setError('Vui lòng nhập giải trình ít nhất 5 ký tự trước khi xác nhận.');
      return;
    }

    try {
      if (user.role === 'MANAGER') {
        await api.patch(`/records/${id}/manager-review`, { status, note });
      } else {
        await api.patch(`/records/${id}/admin-review`, { status, note });
      }
      setSuccess('Xử lý duyệt hồ sơ thành công.');
      setNoteByRecord((prev) => ({ ...prev, [id]: '' }));
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidation = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidation || 'Không thể xử lý hồ sơ.');
    }
  };

  const viewEvidence = async (id) => {
    setError('');
    try {
      const res = await api.get(`/records/${id}/evidence`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể mở file minh chứng.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Duyệt hồ sơ CME</h1>
        <p>{queueHint}</p>
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Khóa học</th>
              <th>Điểm</th>
              <th>Trạng thái</th>
              <th>Nộp lúc</th>
              <th>Minh chứng</th>
              <th>Giải trình</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id}>
                <td>{r.userId?.name || '-'}</td>
                <td>{r.title}</td>
                <td>{r.points}</td>
                <td>{statusLabel[r.status] || r.status}</td>
                <td>{formatDateTimeVN(r.createdAt)}</td>
                <td>
                  <button className="btn btn-inline btn-soft" type="button" onClick={() => viewEvidence(r._id)}>
                    Xem file
                  </button>
                </td>
                <td style={{ minWidth: 260 }}>
                  <textarea
                    rows={2}
                    placeholder="Nhập lý do duyệt/từ chối"
                    value={noteByRecord[r._id] || ''}
                    onChange={(e) => setNoteByRecord((prev) => ({ ...prev, [r._id]: e.target.value }))}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </td>
                <td>
                  <button className="btn btn-inline" type="button" onClick={() => review(r._id, 'approve')}>
                    Duyệt
                  </button>
                  <button className="btn btn-inline btn-soft-danger" type="button" onClick={() => review(r._id, 'reject')}>
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {records.length === 0 && <p className="muted">Không có hồ sơ nào trong hàng chờ duyệt.</p>}
      </div>
    </div>
  );
}
