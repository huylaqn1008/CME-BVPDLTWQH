import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const roleLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

const currency = (value) => Intl.NumberFormat('vi-VN').format(value);

const StatCard = ({ label, value, icon, tone = 'blue', note }) => (
  <div className="stat-card">
    <div className={`stat-icon stat-${tone}`}>{icon}</div>
    <div>
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  </div>
);

const SectionHead = ({ title, subtitle, action }) => (
  <div className="section-head">
    <div>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {action ? <div className="section-action">{action}</div> : null}
  </div>
);

const BarChart = ({ items, max }) => (
  <div className="bar-chart">
    {items.map((item) => (
      <div key={item.label} className="bar-row">
        <div className="bar-meta">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
        <div className="bar-track">
          <div
            className={`bar-fill ${item.tone || ''}`}
            style={{ width: `${Math.round((item.value / max) * 100)}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);

const ActivityItem = ({ name, action, time, tone = 'blue' }) => (
  <div className="activity-item">
    <div className={`avatar avatar-${tone}`}>{name.slice(0, 2).toUpperCase()}</div>
    <div>
      <p className="activity-text"><strong>{name}</strong> {action}</p>
      <span className="activity-time">{time}</span>
    </div>
  </div>
);

const Pill = ({ label, tone = 'blue' }) => (
  <span className={`pill pill-${tone}`}>{label}</span>
);

const EmptyState = ({ title, description }) => (
  <div className="alert-card">
    <p className="alert-title">{title}</p>
    <p className="alert-text">{description}</p>
  </div>
);

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data));
  }, []);

  const year = new Date().getFullYear();

  // compute derived values early so hooks run in the same order every render
  const adminChart = useMemo(
    () => {
      if (data?.departmentStats?.length) {
        return data.departmentStats.map((dept) => ({
          label: dept.name,
          value: dept.total,
          tone: 'blue',
        }));
      }
      return [{ label: 'Toàn bệnh viện', value: data?.totalPointsYear || 0, tone: 'blue' }];
    },
    [data?.departmentStats, data?.totalPointsYear]
  );

  if (!data) return <div className="page">Đang tải dữ liệu...</div>;

  const role = data.role || 'ADMIN';

  const adminStats = [
    { label: 'Tổng số bác sĩ', value: currency(data.totalStaff || 0), icon: 'BS', tone: 'blue' },
    { label: 'Khóa CME đang mở', value: currency(data.openCourses || 0), icon: 'KH', tone: 'teal' },
    { label: 'Tổng điểm CME toàn viện', value: currency(data.totalPointsYear || 0), icon: 'ĐI', tone: 'indigo' },
    { label: 'Tỷ lệ đạt chuẩn CME', value: `${data.reachedStandardPercent || 0}%`, icon: 'TC', tone: 'amber' },
    { label: 'Bác sĩ thiếu điểm', value: currency(data.missingCount || 0), icon: 'TH', tone: 'rose' },
  ];

  const managerStats = [
    { label: 'Tổng bác sĩ trong khoa', value: currency(data.totalStaffInDepartment || 0), icon: 'BS', tone: 'blue' },
    { label: 'Số người đạt chuẩn', value: currency(Math.max(0, (data.totalStaffInDepartment || 0) - (data.lacking || 0))), icon: 'TC', tone: 'teal' },
    { label: 'Số người thiếu điểm', value: currency(data.lacking || 0), icon: 'TH', tone: 'rose' },
    { label: 'Hồ sơ chờ duyệt', value: currency(data.pendingRecords || 0), icon: 'HS', tone: 'amber' },
  ];

  const doctorStats = [
    { label: 'Tổng điểm CME', value: currency(data.totalPoints || 0), icon: 'ĐI', tone: 'blue' },
    { label: 'Điểm còn thiếu', value: currency(data.pointsRemaining || 0), icon: 'TH', tone: 'rose' },
    { label: 'Hồ sơ chờ duyệt', value: currency(data.pending || 0), icon: 'HS', tone: 'amber' },
    { label: 'Khóa đã tham gia', value: '—', icon: 'KH', tone: 'teal', note: 'Chưa có dữ liệu' },
  ];

  const reachedPercent = Math.min(100, Math.max(0, data.reachedStandardPercent || 0));

  return (
    <div className="page dashboard">
      <div className="page-head">
        <h1>Bảng điều khiển CME</h1>
        <p>{roleLabel[role]} · Tổng quan nhanh tình trạng đào tạo và phê duyệt hồ sơ năm {year}.</p>
      </div>

      {role === 'ADMIN' && (
        <>
          <div className="stat-grid stat-grid-5">
            {adminStats.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="dashboard-row">
            <div className="card">
              <SectionHead title="Thống kê điểm CME theo khoa" subtitle="Tổng điểm đã duyệt trong năm" />
              <BarChart items={adminChart} max={Math.max(1, ...adminChart.map((item) => item.value))} />
              {adminChart.length === 1 && adminChart[0].label === 'Toàn bệnh viện' && (
                <EmptyState title="Thiếu dữ liệu theo khoa" description="" />
              )}
            </div>
            <div className="card">
              <SectionHead title="Phân bố đạt chuẩn" subtitle="Tỷ lệ bác sĩ đạt chuẩn CME" />
              <div className="pie-wrap">
                <div
                  className="pie"
                  style={{
                    background: `conic-gradient(var(--ok) 0 ${reachedPercent}%, #f2c6cd ${reachedPercent}% 100%)`,
                  }}
                />
                <div className="pie-legend">
                  <div className="legend-item">
                    <span className="legend-dot ok" />
                    <span>Đạt chuẩn</span>
                    <strong>{reachedPercent}%</strong>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot warn" />
                    <span>Chưa đạt</span>
                    <strong>{100 - reachedPercent}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-row">
            <div className="card">
              <SectionHead title="Hoạt động gần đây" subtitle="Cập nhật realtime từ hệ thống" />
              <div className="activity-list">
                {data.recentActivities?.length ? (
                  data.recentActivities.map((activity, index) => (
                    <ActivityItem
                      key={index}
                      name={activity.name}
                      action={activity.action}
                      time={new Date(activity.time).toLocaleDateString('vi-VN')}
                      tone="blue"
                    />
                  ))
                ) : (
                  <ActivityItem name="Hệ thống" action="đang chờ dữ liệu" time="Hôm nay" tone="blue" />
                )}
              </div>
            </div>
            <div className="card">
              <SectionHead title="Công việc cần xử lý" subtitle="Ưu tiên trong 7 ngày tới" />
              <div className="pending-list">
                {data.pendingTasks?.map((task, index) => (
                  <div key={index} className="pending-item">
                    <div>
                      <p>{task.label}</p>
                      <span>{currency(task.value)} {task.type === 'records' ? 'trường hợp' : 'người'}</span>
                    </div>
                    <Pill label={task.type === 'records' ? 'Duyệt' : 'Theo dõi'} tone={task.type === 'records' ? 'amber' : 'blue'} />
                  </div>
                )) || (
                  <>
                    <div className="pending-item">
                      <div>
                        <p>Hồ sơ CME chờ duyệt</p>
                        <span>{currency(data.missingCount || 0)} trường hợp thiếu điểm</span>
                      </div>
                      <Pill label="Theo dõi" tone="amber" />
                    </div>
                    <div className="pending-item">
                      <div>
                        <p>Phân bố đạt chuẩn</p>
                        <span>{reachedPercent}% bác sĩ đạt chuẩn</span>
                      </div>
                      <Pill label="Báo cáo" tone="blue" />
                    </div>
                    <div className="pending-item">
                      <div>
                        <p>Tổng điểm CME năm</p>
                        <span>{currency(data.totalPointsYear || 0)} điểm đã duyệt</span>
                      </div>
                      <Pill label="Thống kê" tone="teal" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {role === 'MANAGER' && (
        <>
          <div className="stat-grid">
            {managerStats.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="card">
            <SectionHead title="Điểm CME của bác sĩ trong khoa" subtitle="Cập nhật theo hồ sơ đã được duyệt" />
            {data.doctorPoints?.length ? (
              <BarChart
                items={data.doctorPoints.map((doc) => ({
                  label: doc.name,
                  value: doc.total,
                  tone: 'blue',
                }))}
                max={Math.max(1, ...data.doctorPoints.map((doc) => doc.total))}
              />
            ) : (
              <EmptyState title="Chưa có dữ liệu" description="" />
            )}
          </div>

          <div className="dashboard-row">
            <div className="card">
              <SectionHead title="Danh sách bác sĩ cần chú ý" subtitle="Ưu tiên bổ sung điểm trong tháng" />
              {data.doctorsNeedingAttention?.length ? (
                <div className="activity-list">
                  {data.doctorsNeedingAttention.map((doc, index) => (
                    <ActivityItem
                      key={index}
                      name={doc.name}
                      action={`còn thiếu ${24 - doc.total} điểm`}
                      time={`Tổng: ${doc.total}/24`}
                      tone="rose"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Chưa có bác sĩ cần chú ý" description="" />
              )}
            </div>
            <div className="card">
              <SectionHead title="Hồ sơ chờ duyệt" subtitle="Xử lý trong hôm nay" />
              {data.pendingRecords > 0 ? (
                <div className="pending-list">
                  <div className="pending-item">
                    <div>
                      <p>Hồ sơ CME chờ duyệt</p>
                      <span>{currency(data.pendingRecords)} hồ sơ</span>
                    </div>
                    <Pill label="Duyệt ngay" tone="amber" />
                  </div>
                </div>
              ) : (
                <EmptyState title="Chưa có hồ sơ chờ duyệt" description="" />
              )}
            </div>
          </div>
        </>
      )}

      {role === 'DOCTOR' && (
        <>
          <div className="stat-grid">
            {doctorStats.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="dashboard-row">
            <div className="card">
              <SectionHead title="Tiến độ CME năm" subtitle="Mục tiêu 24 điểm" />
              <div className="progress-wrap">
                <div className="progress-meta">
                  <strong>{data.totalPoints || 0} / 24 điểm</strong>
                  <span>{data.pointsRemaining || 0} điểm còn thiếu</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, Math.round(((data.totalPoints || 0) / 24) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="card">
              <SectionHead title="Khóa học gợi ý" subtitle="Phù hợp chuyên môn hiện tại" />
              {data.suggestedCourses?.length ? (
                <div className="activity-list">
                  {data.suggestedCourses.map((course, index) => (
                    <ActivityItem
                      key={index}
                      name={course.title}
                      action={`${course.points} điểm CME`}
                      time="Đang mở"
                      tone="teal"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Chưa có khóa học phù hợp" description="" />
              )}
            </div>
          </div>

          <div className="card">
            <SectionHead title="Hồ sơ CME gần đây" subtitle="Trạng thái mới nhất" />
            {data.recentRecords?.length ? (
              <div className="activity-list">
                {data.recentRecords.map((record, index) => (
                  <ActivityItem
                    key={index}
                    name={record.title}
                    action={`${record.points} điểm`}
                    time={new Date(record.date).toLocaleDateString('vi-VN')}
                    tone="blue"
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có hồ sơ CME" description="" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
