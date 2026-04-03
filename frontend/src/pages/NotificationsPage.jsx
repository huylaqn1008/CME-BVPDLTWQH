import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/courses/Pagination';
import { useAuth } from '../context/AuthContext';

const formatRelativeTimeVN = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const getBadgeChar = (priority) => {
  if (priority === 'CRITICAL') return '!';
  return '•';
};

const getPrimaryActionLabel = (item, role) => {
  if (role === 'DOCTOR') {
    if (item.type === 'COURSE_CREATED' || item.type === 'COURSE_UPDATED' || item.category === 'learning') return 'Xem';
    if (item.type === 'COURSE_DEADLINE') return 'Xem';
    if (item.type === 'RECORD_APPROVED' || item.type === 'RECORD_REVIEWED' || item.type === 'RECORD_REJECTED') return 'Xem';
    return 'Mở';
  }

  if (role === 'MANAGER') {
    if (item.type === 'RECORD_SUBMITTED' || item.type === 'FINAL_APPROVAL_PENDING') return 'Xem';
    if (item.type === 'COURSE_CREATED' || item.type === 'COURSE_UPDATED') return 'Xem';
    return 'Mở';
  }

  if (role === 'ADMIN') {
    if (item.type === 'AUDIT_ALERT' || item.type === 'SYSTEM_ALERT') return 'Xem log';
    if (item.type === 'BULK_IMPORT_COMPLETED') return 'Xem';
    if (item.type === 'COURSE_CREATED' || item.type === 'COURSE_UPDATED') return 'Xem';
    return 'Mở';
  }

  return 'Mở';
};

const groupKey = (item) =>
  item.groupKey ||
  [
    item.type,
    item.title,
    item.message,
    item.link,
    item.priority,
    item.category,
    item.audienceType,
  ]
    .map((part) => String(part || '').trim())
    .join('|');

const mergeGroups = (items) => {
  const map = new Map();
  items.forEach((item) => {
    const key = groupKey(item);
    const current = map.get(key);
    if (!current) {
      map.set(key, { key, item, ids: [item._id], count: 1, newestAt: item.createdAt });
      return;
    }
    current.ids.push(item._id);
    current.count += 1;
    if (new Date(item.createdAt).getTime() > new Date(current.newestAt).getTime()) {
      current.item = item;
      current.newestAt = item.createdAt;
    }
  });
  return [...map.values()].sort((a, b) => new Date(b.newestAt) - new Date(a.newestAt));
};

const isUnread = (item) => !item.virtual && !item.isRead;

export default function NotificationsPage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState({
    reminders: [],
    notifications: [],
    unreadCount: 0,
    reminderCount: 0,
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications', {
        params: {
          page,
          pageSize,
          read: filter === 'all' ? undefined : filter,
        },
      });
      setPayload(
        res.data || {
          reminders: [],
          notifications: [],
          unreadCount: 0,
          reminderCount: 0,
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        }
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách thông báo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filter]);

  const refresh = async () => {
    await load();
  };

  const markGroupAsRead = async (ids = []) => {
    try {
      setActionLoading(true);
      await Promise.all(ids.map((id) => api.patch(`/notifications/${id}/read`)));
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đánh dấu đã đọc.');
    } finally {
      setActionLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setActionLoading(true);
      await api.patch('/notifications/read-all');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đánh dấu tất cả là đã đọc.');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteReadNotifications = async () => {
    try {
      setActionLoading(true);
      await api.delete('/notifications/read');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể xóa thông báo đã đọc.');
    } finally {
      setActionLoading(false);
    }
  };

  const importantNotice = useMemo(() => {
    const unreadItems = [...(payload.reminders || []), ...(payload.notifications || [])].filter((item) => isUnread(item));
    const critical = unreadItems.find((item) => item.priority === 'CRITICAL');
    if (critical) return critical;
    const reminder = (payload.reminders || []).find(Boolean);
    if (reminder) return reminder;
    return unreadItems[0] || null;
  }, [payload]);

  const groupedItems = useMemo(() => mergeGroups([...(payload.reminders || []), ...(payload.notifications || [])]), [payload]);
  const roleLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'MANAGER' ? 'Quản lý' : 'Bác sĩ';

  if (loading) {
    return (
      <div className="page notifications-minimal-page">
        <div className="page-head">
          <h1>Thông báo</h1>
          <p>Quản lý và xử lý các thông báo hệ thống.</p>
        </div>
        <div className="notifications-minimal-skeleton">
          <div className="notifications-minimal-skeleton-line" />
          <div className="notifications-minimal-skeleton-line" />
          <div className="notifications-minimal-skeleton-line" />
          <div className="notifications-minimal-skeleton-line" />
        </div>
      </div>
    );
  }

  return (
    <div className="page notifications-minimal-page">
      <div className="page-head notifications-minimal-head">
        <div>
          <h1>Thông báo</h1>
          <p>Quản lý và xử lý các thông báo hệ thống.</p>
        </div>
        <div className="notifications-minimal-actions">
          <button className="btn btn-ghost" type="button" onClick={markAllAsRead} disabled={actionLoading || payload.unreadCount === 0}>
            Đánh dấu tất cả đã đọc
          </button>
          <button className="btn btn-soft-danger" type="button" onClick={deleteReadNotifications} disabled={actionLoading}>
            Xóa thông báo đã đọc
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {importantNotice && (
        <div className="notification-spotlight">
          <div className="notification-spotlight-mark">!</div>
          <div className="notification-spotlight-body">
            <p className="notification-spotlight-title">{importantNotice.title}</p>
            <p className="notification-spotlight-text">{importantNotice.message}</p>
          </div>
          <div className="notification-spotlight-action">
            {importantNotice.link && (
              <Link className="btn btn-inline btn-soft" to={importantNotice.link}>
                {getPrimaryActionLabel(importantNotice, user?.role)}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="notifications-minimal-filter">
        <button type="button" className={`minimal-chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          Tất cả
        </button>
        <button type="button" className={`minimal-chip ${filter === 'unread' ? 'is-active' : ''}`} onClick={() => setFilter('unread')}>
          Chưa đọc
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} / trang
            </option>
          ))}
        </select>
        <span className="notifications-minimal-meta">Vai trò: {roleLabel}</span>
      </div>

      <div className="notifications-minimal-list">
        {groupedItems.map((group) => {
          const item = group.item;
          const unread = group.ids.some((id) => {
            const match = [...payload.reminders, ...payload.notifications].find((entry) => entry._id === id);
            return match && isUnread(match);
          });
          const actionableIds = group.ids.filter((id) => {
            const match = [...payload.reminders, ...payload.notifications].find((entry) => entry._id === id);
            return match && !match.virtual && !match.isRead;
          });
          const actionLabel = getPrimaryActionLabel(item, user?.role);

          return (
            <div key={group.key} className={`notifications-minimal-item ${unread ? 'is-unread' : 'is-read'}`}>
              <div className="notifications-minimal-dot">{getBadgeChar(item.priority)}</div>
              <div className="notifications-minimal-content">
                <div className="notifications-minimal-main">
                  <div className="notifications-minimal-title-row">
                    <p className="notifications-minimal-title">{group.count > 1 ? `${item.title} (${group.count})` : item.title}</p>
                    {unread && <span className="notifications-minimal-unread">Chưa đọc</span>}
                  </div>
                  <p className="notifications-minimal-time">{formatRelativeTimeVN(item.createdAt)}</p>
                </div>
                <div className="notifications-minimal-actions">
                  {item.link && (
                    <Link className="minimal-link" to={item.link}>
                      {actionLabel}
                    </Link>
                  )}
                  {actionableIds.length > 0 && (
                    <button className="minimal-link minimal-link-button" type="button" onClick={() => markGroupAsRead(actionableIds)}>
                      Đã đọc
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {groupedItems.length === 0 && <p className="notifications-minimal-empty">Không có thông báo nào trong bộ lọc này.</p>}
      </div>

      <Pagination page={payload.pagination.page} totalPages={payload.pagination.totalPages} onPageChange={setPage} />
    </div>
  );
}
