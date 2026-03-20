import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const roleLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

const formatDateForVietnamDisplay = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const parseVietnamDate = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (
    date.getUTCFullYear() !== Number(yyyy) ||
    date.getUTCMonth() !== Number(mm) - 1 ||
    date.getUTCDate() !== Number(dd)
  ) {
    return null;
  }

  return `${yyyy}-${mm}-${dd}`;
};

const CCCD_PROVINCE_CODES = new Set([
  '001', '002', '004', '006', '008', '010', '011', '012', '014', '015',
  '017', '019', '020', '022', '024', '025', '026', '027', '030', '031',
  '033', '034', '035', '036', '037', '038', '040', '042', '044', '045',
  '046', '048', '049', '051', '052', '054', '056', '058', '060', '062',
  '064', '066', '067', '068', '070', '072', '074', '075', '077', '079',
  '080', '082', '083', '084', '086', '087', '089', '091', '092', '093',
  '094', '095', '096',
]);

const VN_MOBILE_PREFIXES = new Set([
  '032', '033', '034', '035', '036', '037', '038', '039',
  '052', '056', '058', '059',
  '070', '076', '077', '078', '079',
  '081', '082', '083', '084', '085', '086', '087', '088', '089',
  '090', '091', '092', '093', '094', '095', '096', '097', '098', '099',
]);

const validateVietnamCccd = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  if (!/^\d{12}$/.test(normalized)) return false;
  const provinceCode = normalized.slice(0, 3);
  if (!CCCD_PROVINCE_CODES.has(provinceCode)) return false;
  const genderCenturyDigit = Number(normalized[3]);
  return Number.isInteger(genderCenturyDigit) && genderCenturyDigit >= 0 && genderCenturyDigit <= 5;
};

const validateVietnamPhone = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return /^\d{10}$/.test(normalized) && VN_MOBILE_PREFIXES.has(normalized.slice(0, 3));
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    birthDate: '',
    cccd: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await api.get('/auth/me');
        if (!mounted) return;
        setProfile(res.data);
        setForm({
          name: res.data?.name || '',
          birthDate: formatDateForVietnamDisplay(res.data?.birthDate),
          cccd: res.data?.cccd || '',
          phone: res.data?.phone || '',
          email: res.data?.email || '',
        });
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.message || 'Không thể tải thông tin cá nhân.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    if (!validateVietnamCccd(form.cccd)) {
      setError('CCCD phải gồm 12 số, 3 số đầu là mã tỉnh và số thứ 4 là mã giới tính/năm sinh hợp lệ.');
      setSaving(false);
      return;
    }

    if (!validateVietnamPhone(form.phone)) {
      setError('Số điện thoại phải gồm 10 số và đúng đầu số hợp lệ ở Việt Nam.');
      setSaving(false);
      return;
    }

    const parsedBirthDate = parseVietnamDate(form.birthDate);
    if (form.birthDate && !parsedBirthDate) {
      setError('Ngày sinh phải theo định dạng dd/mm/yyyy.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        birthDate: parsedBirthDate || '',
      };
      const res = await api.patch('/auth/me', payload);
      setProfile(res.data);
      await refreshUser();
      setSuccess('Đã lưu thông tin cá nhân.');
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidationError = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidationError || 'Không thể lưu thông tin cá nhân.');
    } finally {
      setSaving(false);
    }
  };

  const activeUser = profile || user;
  const departmentName = activeUser?.departmentId?.name || 'Không có';

  if (loading) return <div className="page">Đang tải thông tin cá nhân...</div>;

  return (
    <div className="page profile-page">
      <div className="page-head">
        <h1>Thông tin cá nhân</h1>
        <p>Cập nhật hồ sơ cá nhân của bạn. Vai trò và khoa/phòng chỉ hiển thị, không được chỉnh sửa.</p>
      </div>

      <div className="profile-grid">
        <section className="card profile-summary-card">
          <p className="chip">Hồ sơ cá nhân</p>
          <h2>{form.name || activeUser?.name || 'Chưa cập nhật'}</h2>
          <p className="profile-summary-role">{roleLabel[activeUser?.role] || activeUser?.role}</p>
          <div className="profile-summary-list">
            <div>
              <span>Vai trò</span>
              <strong>{roleLabel[activeUser?.role] || activeUser?.role}</strong>
            </div>
            <div>
              <span>Khoa/Phòng</span>
              <strong>{departmentName}</strong>
            </div>
            <div>
              <span>Tên đăng nhập</span>
              <strong>{user?.username || '-'}</strong>
            </div>
          </div>
        </section>

        <form className="card profile-form-card" onSubmit={submit}>
          <div className="profile-form-grid">
            <label className="profile-field">
              <span>Họ và tên</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nhập họ và tên"
              />
            </label>
            <label className="profile-field">
              <span>Ngày tháng năm sinh</span>
              <input
                type="text"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                maxLength={10}
              />
            </label>
            <label className="profile-field">
              <span>Vai trò</span>
              <input value={roleLabel[activeUser?.role] || activeUser?.role || ''} disabled />
            </label>
            <label className="profile-field">
              <span>Khoa/Phòng</span>
              <input value={departmentName} disabled />
            </label>
            <label className="profile-field">
              <span>CCCD</span>
              <input
                value={form.cccd}
                onChange={(e) => setForm({ ...form, cccd: e.target.value })}
                placeholder="Nhập số CCCD"
                inputMode="numeric"
                maxLength={12}
              />
            </label>
            <label className="profile-field">
              <span>Số điện thoại</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Nhập số điện thoại"
                inputMode="numeric"
                maxLength={10}
              />
            </label>
            <label className="profile-field profile-span-2">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Nhập email"
              />
            </label>
          </div>

          <div className="profile-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </div>
  );
}
