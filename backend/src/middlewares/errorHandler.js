module.exports = (err, _req, res, _next) => {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File quá lớn. Kích thước tối đa là 5MB.' });
  }

  if (err.message === 'Only PDF or image files are allowed') {
    return res.status(400).json({ message: 'Chỉ cho phép upload file PDF/JPG/PNG/WEBP' });
  }

  if (err.code === 11000) {
    if (err.keyPattern?.username) {
      return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });
    }
    return res.status(409).json({ message: 'Dữ liệu bị trùng, vui lòng kiểm tra lại' });
  }

  return res.status(500).json({ message: 'Internal server error' });
};
