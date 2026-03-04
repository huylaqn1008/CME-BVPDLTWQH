import { useEffect, useState } from 'react';
import api from '../api/client';

const keyLabel = {
  role: 'Vai trò',
  totalStaff: 'Tổng số bác sĩ',
  totalPointsYear: 'Tổng điểm năm hiện tại',
  reachedStandardPercent: 'Tỷ lệ đạt chuẩn (%)',
  missingCount: 'Số người thiếu điểm',
  totalStaffInDepartment: 'Tổng người trong khoa/phòng',
  lacking: 'Số người thiếu điểm',
  pendingRecords: 'Hồ sơ chờ duyệt',
  totalPoints: 'Tổng điểm cá nhân',
  pointsRemaining: 'Điểm còn thiếu',
  pending: 'Hồ sơ chờ duyệt',
};

const valueLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="page">Đang tải dữ liệu...</div>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Bảng điều khiển CME</h1>
        <p>Theo dõi tổng quan điểm đào tạo và tiến độ duyệt hồ sơ.</p>
      </div>
      <div className="metrics-grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="metric-card">
            <p>{keyLabel[key] || key}</p>
            <h3>{valueLabel[value] || String(value)}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
