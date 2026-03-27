import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Pagination from '../components/courses/Pagination';

const roleLabel = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý khoa/phòng',
  DOCTOR: 'Bác sĩ',
};

const roleOptions = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'ADMIN', label: 'Quản trị hệ thống' },
  { value: 'MANAGER', label: 'Quản lý khoa/phòng' },
  { value: 'DOCTOR', label: 'Bác sĩ' },
];

const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngưng hoạt động' },
];

const pageSizeOptions = [10, 20, 50];
const strongPassword = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,}$/;

const emptyForm = {
  name: '',
  username: '',
  password: '',
  role: 'DOCTOR',
  departmentId: '',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalError, setModalError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const importInputRef = useRef(null);
  const firstFetchRef = useRef(true);

  const loadDepartments = async () => {
    const res = await api.get('/departments');
    setDepartments(res.data || []);
  };

  const loadUsers = async () => {
    try {
      if (firstFetchRef.current) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }

      const res = await api.get('/users', {
        params: {
          page,
          pageSize,
          q: searchQuery || undefined,
          role: roleFilter || undefined,
          departmentId: departmentFilter || undefined,
          status: statusFilter || undefined,
        },
      });

      const payload = res.data;
      if (Array.isArray(payload)) {
        setUsers(payload);
        setPagination({ page: 1, pageSize: payload.length || pageSize, total: payload.length, totalPages: 1 });
      } else {
        setUsers(payload.users || []);
        setPagination(payload.pagination || { page, pageSize, total: 0, totalPages: 0 });
      }
      setError('');
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể tải danh sách người dùng.');
    } finally {
      if (firstFetchRef.current) {
        firstFetchRef.current = false;
        setLoading(false);
      } else {
        setTableLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDepartments().catch(() => setError('Không thể tải danh sách khoa/phòng.'));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, departmentFilter, statusFilter, pageSize]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchQuery, roleFilter, departmentFilter, statusFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId('');
    setShowPassword(false);
    setModalError('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingId(user._id);
    setShowPassword(false);
    setModalError('');
    setSuccess('Đang chỉnh sửa người dùng.');
    setForm({
      name: user.name || '',
      username: user.username || '',
      password: '',
      role: user.role || 'DOCTOR',
      departmentId: user.departmentId?._id || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const onDelete = async (id) => {
    const ok = window.confirm('Bạn chắc chắn muốn xóa người dùng này?');
    if (!ok) return;

    try {
      await api.delete(`/users/${id}`);
      if (editingId === id) closeModal();
      setSuccess('Xóa người dùng thành công.');
      setError('');
      loadUsers();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Không thể xóa người dùng.');
    }
  };

  const submitUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setModalError('');
    const passwordValue = form.password.trim();
    if ((!editingId || passwordValue) && !strongPassword.test(passwordValue)) {
      setModalError('Mật khẩu cần ít nhất 6 ký tự, có 1 chữ in hoa và 1 ký tự đặc biệt.');
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
      closeModal();
      loadUsers();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidationError = err.response?.data?.errors?.[0]?.msg;
      setModalError(apiMessage || firstValidationError || 'Không thể lưu người dùng, vui lòng kiểm tra lại thông tin.');
    }
  };

  const importExcel = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setImporting(true);
      setImportError('');
      setImportSuccess('');
      const res = await api.post('/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSuccess(
        `${res.data?.message || 'Import thành công.'} Đã tạo ${res.data?.createdCount || 0} tài khoản. Mật khẩu mặc định: ${res.data?.defaultPassword || 'Meoken1@2@3'}`
      );
      if (importInputRef.current) importInputRef.current.value = '';
      setImportFile(null);
      loadUsers();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstImportError = err.response?.data?.errors?.[0];
      const detail = firstImportError ? `Dòng ${firstImportError.row}: ${firstImportError.message}` : '';
      setImportError(apiMessage || detail || 'Không thể import file Excel.');
    } finally {
      setImporting(false);
    }
  };

  const onImportClick = () => importInputRef.current?.click();

  const onImportFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    setImportFile(file);
    if (!file) return;
    await importExcel(file);
  };

  if (loading) return <div className="page">Đang tải danh sách người dùng...</div>;

  return (
    <div className="page users-page">
      <div className="page-head users-head">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Quản lý tài khoản bệnh viện theo mô hình phân trang, lọc nhanh và biểu mẫu gọn để phù hợp dữ liệu lớn.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card users-toolbar-card">
        <div className="users-actions">
          <div className="users-actions-left">
            <button className="btn" type="button" onClick={openCreateModal}>
              + Tạo người dùng
            </button>
            <button className="btn btn-ghost" type="button" onClick={onImportClick} disabled={importing}>
              {importing ? 'Đang import...' : 'Import Excel'}
            </button>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="visually-hidden" onChange={onImportFileChange} />
          </div>
          <div className="users-actions-right">
            <span className="chip">Tổng: {pagination.total}</span>
            <span className="chip">Trang {pagination.page}/{pagination.totalPages || 1}</span>
          </div>
        </div>

        <div className="users-filter-top">
          <div>
            <h2 className="section-title">Bộ lọc</h2>
            <p className="muted">Tìm theo tên hoặc username. Có thể lọc theo vai trò, khoa/phòng, trạng thái và số dòng mỗi trang.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? 'Thu gọn' : 'Mở lọc'}
          </button>
        </div>

        {showFilters && (
          <div className="users-filter-grid">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên, username..."
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {roleOptions.map((option) => (
                <option key={option.value || 'all-role'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">Tất cả khoa/phòng</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </select>
          </div>
        )}

        {(importFile || importError || importSuccess) && (
          <div className="users-import-status">
            {importFile && <span className="field-hint">Đang chọn file: {importFile.name}</span>}
            {importError && <p className="error">{importError}</p>}
            {importSuccess && <p className="success">{importSuccess}</p>}
          </div>
        )}
        <p className="field-hint">Cột Excel bắt buộc: Họ và tên, Tên tài khoản, Khoa/Phòng, Vai trò. Mật khẩu mặc định: Meoken1@2@3.</p>
      </div>

      <div className="card users-table-card">
        <div className="users-table-head">
          <div>
            <h2 className="section-title">Danh sách người dùng</h2>
            <p className="muted">Danh sách được tải theo trang để giữ giao diện gọn và ổn định khi dữ liệu lớn.</p>
          </div>
          <div className="chip">{tableLoading ? 'Đang cập nhật...' : `Hiển thị ${users.length} bản ghi`}</div>
        </div>

        <div className="table-shell users-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>HỌ TÊN</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>VAI TRÒ</th>
                <th>KHOA/PHÒNG</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="user-name-cell">{u.name}</div>
                  </td>
                  <td>{u.username}</td>
                  <td>{roleLabel[u.role] || u.role}</td>
                  <td>{u.departmentId?.name || '-'}</td>
                  <td>
                    <span className={`status-pill ${u.isActive ? 'is-open' : 'is-closed'}`}>
                      {u.isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-inline btn-soft" type="button" onClick={() => openEditModal(u)}>
                        Sửa
                      </button>
                      <button className="btn btn-inline btn-soft-danger" type="button" onClick={() => onDelete(u._id)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && <p className="muted users-empty">Không có người dùng nào khớp bộ lọc hiện tại.</p>}
        </div>

        <div className="users-mobile-list">
          {users.map((u) => (
            <article key={u._id} className="user-mobile-card">
              <div className="user-mobile-top">
                <div>
                  <h3>{u.name}</h3>
                  <p>{u.username}</p>
                </div>
                <span className={`status-pill ${u.isActive ? 'is-open' : 'is-closed'}`}>
                  {u.isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                </span>
              </div>
              <div className="user-mobile-meta">
                <div>
                  <span>Vai trò</span>
                  <strong>{roleLabel[u.role] || u.role}</strong>
                </div>
                <div>
                  <span>Khoa/Phòng</span>
                  <strong>{u.departmentId?.name || '-'}</strong>
                </div>
              </div>
              <div className="row-actions user-mobile-actions">
                <button className="btn btn-inline btn-soft" type="button" onClick={() => openEditModal(u)}>
                  Sửa
                </button>
                <button className="btn btn-inline btn-soft-danger" type="button" onClick={() => onDelete(u._id)}>
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>

        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>{editingId ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h3>
              <p>Biểu mẫu ngắn gọn để tạo hoặc chỉnh sửa tài khoản mà không làm dài trang.</p>
            </div>

            <form className="modal-form" onSubmit={submitUser}>
              <div className="modal-grid two-col">
                <label className="profile-field">
                  <span>Họ và tên</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Họ và tên" />
                </label>
                <label className="profile-field">
                  <span>Tên đăng nhập</span>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Tên đăng nhập" />
                </label>
                <label className="profile-field password-field profile-span-2">
                  <span>Mật khẩu</span>
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
                </label>
                <label className="profile-field">
                  <span>Vai trò</span>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="ADMIN">Quản trị hệ thống</option>
                    <option value="MANAGER">Quản lý khoa/phòng</option>
                    <option value="DOCTOR">Bác sĩ</option>
                  </select>
                </label>
                <label className="profile-field">
                  <span>Khoa/Phòng</span>
                  <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">Chọn khoa/phòng</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="muted">
                Quy tắc mật khẩu: tối thiểu 6 ký tự, có 1 chữ in hoa và 1 ký tự đặc biệt. Nếu sửa user thì để trống mật khẩu để giữ nguyên.
              </p>
              {modalError && <p className="error">{modalError}</p>}

              <div className="modal-footer">
                <button className="btn btn-ghost" type="button" onClick={closeModal}>
                  Hủy
                </button>
                <button className="btn" type="submit">
                  {editingId ? 'Lưu cập nhật' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
