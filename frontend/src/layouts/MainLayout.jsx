import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const linksByRole = {
  ADMIN: [
    { to: '/', label: 'Bảng điều khiển' },
    { to: '/profile', label: 'Thông tin cá nhân' },
    { to: '/notifications', label: 'Thông báo' },
    { to: '/users', label: 'Người dùng' },
    { to: '/departments', label: 'Khoa/Phòng' },
    { to: '/courses', label: 'Khóa học' },
    { to: '/activities', label: 'Hoạt động' },
    { to: '/approvals', label: 'Duyệt hồ sơ' },
  ],
  MANAGER: [
    { to: '/', label: 'Bảng điều khiển' },
    { to: '/profile', label: 'Thông tin cá nhân' },
    { to: '/notifications', label: 'Thông báo' },
    { to: '/my-courses', label: 'Khóa học của tôi' },
    { to: '/department-doctors', label: 'Bác sĩ trong khoa' },
    { to: '/approvals', label: 'Duyệt hồ sơ' },
    { to: '/records', label: 'Hồ sơ CME' },
  ],
  DOCTOR: [
    { to: '/', label: 'Bảng điều khiển' },
    { to: '/profile', label: 'Thông tin cá nhân' },
    { to: '/notifications', label: 'Thông báo' },
    { to: '/my-courses', label: 'Khóa học của tôi' },
    { to: '/upload', label: 'Nộp minh chứng' },
    { to: '/records', label: 'Hồ sơ của tôi' },
  ],
};

const roleLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const links = linksByRole[user?.role] || [];

  useEffect(() => {
    if (!user) return undefined;

    let mounted = true;
    const loadUnread = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        if (mounted) setUnreadCount(res.data?.unreadCount || 0);
      } catch (_err) {
        if (mounted) setUnreadCount(0);
      }
    };

    loadUnread();
    const timer = setInterval(loadUnread, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user]);

  return (
    <div className="shell">
      <aside className="side-panel">
        <div>
          <p className="brand-sub">Nội bộ bệnh viện</p>
          <h2 className="brand-title">CME Manager</h2>
        </div>

        <nav className="menu-list">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} className="menu-item">
              <span>{item.label}</span>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="menu-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="side-spacer" />

        <div className="profile-box">
          <p className="profile-name">{user?.name}</p>
          <p className="profile-role">{roleLabel[user?.role] || user?.role}</p>
          <p className="profile-user">@{user?.username}</p>
        </div>

        <button className="btn btn-light" onClick={logout}>Đăng xuất</button>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
