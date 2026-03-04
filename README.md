# CME Manager (MERN)

## 1) Cài dependencies

### Option A - npm (khuyến nghị)
- Backend:
  - `cd backend`
  - `npm install`
- Frontend:
  - `cd ..\frontend`
  - `npm install`

### Option B - yarn
- Backend: `yarn`
- Frontend: `yarn`

### Option C - pnpm
- Backend: `pnpm install`
- Frontend: `pnpm install`

## 2) Cấu hình env
- Đã tạo sẵn:
  - `backend/.env` (đã chứa MONGO_URI bạn gửi)
  - `frontend/.env`

## 3) Seed tài khoản quản trị hệ thống đầu tiên
- `cd backend`
- `npm run seed`

Tài khoản mặc định:
- username: `admin`
- password: `Admin@123`

## 4) Chạy hệ thống
- Terminal 1 (backend):
  - `cd backend`
  - `npm run dev`
- Terminal 2 (frontend):
  - `cd frontend`
  - `npm run dev`

Frontend: `http://localhost:5173` hoặc `http://localhost:5174`
Backend: `http://localhost:5000`

## 5) Quy tắc mật khẩu
Khi tạo user hoặc reset mật khẩu:
- Tối thiểu 6 ký tự
- Có ít nhất 1 chữ in hoa
- Có ít nhất 1 ký tự đặc biệt

## MVP hiện có
- Login JWT theo `username`
- Role-based routing frontend
- Vai trò: `ADMIN` (Quản trị hệ thống), `MANAGER` (Quản lý khoa/phòng), `DOCTOR` (Bác sĩ)
- Quản lý user (ADMIN)
- Quản lý khoa/phòng: thêm, sửa, xóa (ADMIN)
- Quản lý khóa học (ADMIN)
- Upload minh chứng ngoại viện PDF (DOCTOR)
- Duyệt 2 cấp: Quản lý khoa/phòng -> Quản trị hệ thống
- Tính tổng điểm và dashboard theo role
- Sinh chứng nhận PDF khi admin duyệt hoặc hoàn thành nội viện
- Soft delete user/department/course
- Audit log hành động chính
