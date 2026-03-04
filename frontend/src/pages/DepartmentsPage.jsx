import { useEffect, useState } from 'react';
import api from '../api/client';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState('');

  const load = async () => {
    const res = await api.get('/departments');
    setDepartments(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await api.patch(`/departments/${editingId}`, form);
    } else {
      await api.post('/departments', form);
    }
    setForm({ name: '', description: '' });
    setEditingId('');
    load();
  };

  const onEdit = (item) => {
    setEditingId(item._id);
    setForm({ name: item.name, description: item.description || '' });
  };

  const onDelete = async (id) => {
    await api.delete(`/departments/${id}`);
    if (editingId === id) {
      setEditingId('');
      setForm({ name: '', description: '' });
    }
    load();
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Quản lý khoa/phòng</h1>
        <p>Thêm, sửa, xóa khoa/phòng phục vụ phân quyền theo đơn vị.</p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <input placeholder="Tên khoa/phòng" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="row-actions">
          <button className="btn" type="submit">{editingId ? 'Cập nhật khoa/phòng' : 'Thêm khoa/phòng'}</button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(''); setForm({ name: '', description: '' }); }}>
              Hủy chỉnh sửa
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr><th>Tên khoa/phòng</th><th>Mô tả</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d._id}>
                <td>{d.name}</td>
                <td>{d.description || '-'}</td>
                <td>
                  <button className="btn btn-inline" onClick={() => onEdit(d)}>Sửa</button>
                  <button className="btn btn-inline btn-danger" onClick={() => onDelete(d._id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
