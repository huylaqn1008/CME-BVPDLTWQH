import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="login-page">
      <div className="login-art" />
      <form className="card login-card" onSubmit={submit}>
        <p className="chip">Hệ thống nội bộ</p>
        <h1>Đăng nhập CME</h1>
        <p className="muted">Quản lý điểm đào tạo liên tục cho bệnh viện</p>

        <input
          placeholder="Tên đăng nhập (hoặc email cũ)"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          placeholder="Mật khẩu"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Đăng nhập</button>
      </form>
    </div>
  );
}
