# Backend API quick test

## Login
POST /api/auth/login
{
  "username": "admin",
  "password": "Admin@123"
}

## Create doctor external record
POST /api/records/external (multipart/form-data)
- title
- points
- evidence (pdf)
