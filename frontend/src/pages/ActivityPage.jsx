import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

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

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState('desc');
  const limit = 20;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  const load = async () => {
    const res = await api.get('/activities', {
      params: { page, limit, q: q.trim(), startDate: startDate || undefined, endDate: endDate || undefined, sort },
    });
    setActivities(res.data.data || []);
    setTotal(res.data.total || 0);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, q, startDate, endDate]);

  const onSubmitFilter = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const onReset = () => {
    setQ('');
    setStartDate('');
    setEndDate('');
    setSort('desc');
    setPage(1);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Hoạt động hệ thống</h1>
        <p>Nhật ký thao tác: tìm kiếm, lọc thời gian, sắp xếp. 20 hoạt động mỗi trang.</p>
      </div>

      <form className="activity-filter" onSubmit={onSubmitFilter}>
        <input
          type="text"
          placeholder="Tìm kiếm theo hành động, người thực hiện..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="desc">Mới nhất</option>
          <option value="asc">Cũ nhất</option>
        </select>
        <button className="btn" type="submit">Lọc</button>
        <button className="btn btn-ghost" type="button" onClick={onReset}>Reset</button>
      </form>

      <div className="card table-shell">
        <table className="admin-table">
          <thead>
            <tr>
              <th>THỜI GIAN</th>
              <th>HÀNH ĐỘNG</th>
              <th>NGƯỜI THỰC HIỆN</th>
              <th>VAI TRÒ</th>
              <th>ĐỐI TƯỢNG</th>
              <th>ĐIỂM</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((item, idx) => (
              <tr key={`${item.type}-${idx}`}>
                <td>{formatDateTimeVN(item.createdAt)}</td>
                <td>{item.action}</td>
                <td>{item.actor}</td>
                <td>{item.role}</td>
                <td>{item.target}</td>
                <td>{item.points ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {activities.length === 0 && <p className="muted">Không có hoạt động trong khoảng thời gian này.</p>}
      </div>

      <div className="pagination-wrap">
        <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
        <span className="pagination-meta">Trang {page}/{totalPages} · {total} hoạt động</span>
        <button className="btn btn-ghost" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Trang sau</button>
      </div>
    </div>
  );
}
