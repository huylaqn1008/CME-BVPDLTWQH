import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

export default function UploadExternalPage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/courses/eligible/me')
      .then((res) => setCourses(res.data))
      .catch(() => setCourses([]));
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((c) => c._id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!selectedCourseId) {
      setError('Vui lòng chọn khóa học trong danh sách khả dụng.');
      return;
    }

    if (!file) {
      setError('Vui lòng chọn file PDF minh chứng.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('courseId', selectedCourseId);
      formData.append('evidence', file);

      await api.post('/records/external', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage('Nộp minh chứng thành công, hồ sơ đang chờ duyệt.');
      setSelectedCourseId('');
      setFile(null);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const firstValidation = err.response?.data?.errors?.[0]?.msg;
      setError(apiMessage || firstValidation || 'Không thể nộp minh chứng. Vui lòng kiểm tra lại.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Nộp minh chứng ngoại viện</h1>
        <p>Chỉ hiển thị khóa học còn hiệu lực theo khoa/phòng của bạn. Không thể nhập tay tên khóa học.</p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={courses.length === 0}
          >
            <option value="">Chọn khóa học khả dụng</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>

          <input type="number" value={selectedCourse?.cmePoints ?? ''} disabled placeholder="Điểm CME tự động" />
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {courses.length === 0 && <p className="muted">Hiện không có khóa học nào khả dụng để nộp minh chứng.</p>}
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <button className="btn" type="submit" disabled={courses.length === 0}>
          Gửi duyệt
        </button>
      </form>
    </div>
  );
}
