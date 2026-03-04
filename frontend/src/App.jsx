import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import CoursesPage from './pages/CoursesPage';
import UploadExternalPage from './pages/UploadExternalPage';
import ApprovalsPage from './pages/ApprovalsPage';
import RecordsPage from './pages/RecordsPage';
import DepartmentsPage from './pages/DepartmentsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/records" element={<RecordsPage />} />

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/courses" element={<CoursesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
            <Route path="/upload" element={<UploadExternalPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN', 'MANAGER']} />}>
            <Route path="/approvals" element={<ApprovalsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
