import { useEffect, useState } from 'react';
import api from '../api/client';

const roleLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

const strongPassword = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,}$/;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'DOCTOR',
    departmentId: '',
  });

  const load = async () => {
    const [u, d] = await Promise.all([api.get('/users'), api.get('/departments')]);
    setUsers(u.data);
    setDepartments(d.data);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ name: '', username: '', password: '', role: 'DOCTOR', departmentId: '' });
    setEditingId('');
    setShowPassword(false);
  };

  const onEdit = (user) => {
    setEditingId(user._id);
    setShowPassword(false);
    setError('');
    setSuccess('Đang chỉnh sửa người dùng.');
    setForm({
      name: user.name || '',
      username: user.username || '',
      password: '',
      role: user.role || 'DOCTOR',
      departmentId: user.departmentId?._id || '',
    });
  };

  const onDelete = async (id) => {
    const ok = window.confirm('Bạn chắc chắn muốn xóa người dùng này?');
    if (!ok) return;

    try {
      await api.delete(`/users/${id}`);
      if (editingId === id) resetForm();
      setSuccess('Xóa người dùng thành công.');
      setError('');
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa người dùng.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const passwordValue = form.password.trim();
    if ((!editingId || passwordValue) && !strongPassword.test(passwordValue)) {
      setError('Mật khẩu cần ít nhất 6 ký tự, có 1 chữ in hoa và 1 ký tự đặc biệt.');
      return;
    }

    try {
      if (editingId) {
        const payload = {
          name: form.name,
          username: form.username,
          role: form.role,
          departmentId: form.departmentId || null,
        };
        if (passwordValue) payload.password = passwordValue;
        await api.patch(`/users/${editingId}`, payload);
        setSuccess('Cập nhật người dùng thành công');
      } else {
        await api.post('/users', form);
        setSuccess('Tạo người dùng thành công');
      }
      resetForm();
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidationError = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidationError || 'Không thể lưu người dùng, vui lòng kiểm tra lại thông tin.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Quản lý người dùng</h1>
        <p>Tạo tài khoản cho quản trị hệ thống, quản lý khoa/phòng và bác sĩ.</p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <input placeholder="Họ và tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Tên đăng nhập" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <div className="password-field">
            <input
              placeholder={editingId ? 'Nhập mật khẩu mới nếu muốn đổi' : 'Mật khẩu'}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? 'Ẩn' : '👁'}
            </button>
          </div>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ADMIN">Quản trị hệ thống</option>
            <option value="MANAGER">Quản lý khoa/phòng</option>
            <option value="DOCTOR">Bác sĩ</option>
          </select>
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">Chọn khoa/phòng</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
        <p className="muted">Quy tắc mật khẩu: tối thiểu 6 ký tự, có 1 chữ in hoa, có 1 ký tự đặc biệt. Khi sửa user, để trống nếu không đổi mật khẩu.</p>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <div className="row-actions">
          <button className="btn" type="submit">{editingId ? 'Lưu cập nhật' : 'Tạo người dùng'}</button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Hủy chỉnh sửa
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Khoa/Phòng</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{roleLabel[u.role] || u.role}</td>
                <td>{u.departmentId?.name || '-'}</td>
                <td>{u.isActive ? 'Đang hoạt động' : 'Đã khóa'}</td>
                <td>
                  <button className="btn btn-inline btn-soft" type="button" onClick={() => onEdit(u)}>Sửa</button>
                  <button className="btn btn-inline btn-soft-danger" type="button" onClick={() => onDelete(u._id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
