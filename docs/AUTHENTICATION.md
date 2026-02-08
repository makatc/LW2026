# Authentication Guide

SUTRA Monitor uses JWT (JSON Web Token) based authentication for securing API endpoints.

## Overview

- **Strategy:** JWT with Bearer tokens
- **Token Expiration:** 7 days
- **Password Hashing:** bcrypt (10 rounds)
- **Roles:** `admin`, `user`

## Default Credentials

**Admin Account:**
- Email: `admin@sutramonitor.com`
- Password: `admin123`

⚠️ **IMPORTANT:** Change the default admin password immediately in production!

## API Endpoints

### Public Endpoints (No Auth Required)

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/verify` - Verify token
- `GET /health` - Health check

### Protected Endpoints (Auth Required)

- `GET /auth/me` - Get current user profile
- All configuration endpoints
- All admin endpoints

## Authentication Flow

### 1. Register New User

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sutramonitor.com",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@sutramonitor.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### 3. Access Protected Endpoints

Include the token in the `Authorization` header:

```bash
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@sutramonitor.com",
    "role": "admin"
  }
}
```

### 4. Verify Token

```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_ACCESS_TOKEN"
  }'
```

**Response:**
```json
{
  "valid": true,
  "payload": {
    "sub": "user-id",
    "email": "user@example.com",
    "role": "user",
    "iat": 1234567890,
    "exp": 1234567890
  }
}
```

## Frontend Integration

### React/Next.js Example

```typescript
// lib/auth.ts
export async function login(email: string, password: string) {
  const response = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  
  // Store token in localStorage or cookie
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

export async function fetchProtected(url: string) {
  const token = localStorage.getItem('token');

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    // Token expired or invalid
    logout();
    throw new Error('Unauthorized');
  }

  return response.json();
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
```

### Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:3001/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Role-Based Access Control

### Backend

Use the `@Roles()` decorator to restrict endpoints:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from './auth/decorators';
import { RolesGuard } from './auth/roles.guard';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  @Roles('admin')
  @Get('users')
  getAllUsers() {
    // Only admins can access
    return [];
  }
}
```

### Frontend

```typescript
function AdminPanel() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  return <div>Admin Panel</div>;
}
```

## Security Best Practices

### Production Checklist

- [ ] Change default admin password
- [ ] Set strong `JWT_SECRET` environment variable
- [ ] Use HTTPS in production
- [ ] Implement rate limiting on auth endpoints
- [ ] Add CORS restrictions
- [ ] Enable refresh tokens for long sessions
- [ ] Implement password reset flow
- [ ] Add email verification
- [ ] Log authentication attempts
- [ ] Implement account lockout after failed attempts

### Environment Variables

```env
# Backend .env
JWT_SECRET=your-very-long-random-secret-key-here
JWT_EXPIRATION=7d
```

### Password Requirements

Current implementation accepts any password. For production, add validation:

```typescript
// Minimum 8 characters, at least one letter and one number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

if (!passwordRegex.test(password)) {
  throw new Error('Password must be at least 8 characters with letters and numbers');
}
```

## Troubleshooting

### "Unauthorized" Error

**Cause:** Token missing, expired, or invalid

**Solution:**
1. Check if token is included in Authorization header
2. Verify token hasn't expired (7 days)
3. Ensure token format is `Bearer YOUR_TOKEN`

### "Cannot find module 'bcrypt'"

**Cause:** bcrypt not installed

**Solution:**
```bash
cd apps/sutra-monitor
pnpm install bcrypt
```

### CORS Errors

**Cause:** Frontend and backend on different origins

**Solution:** Update backend CORS configuration in `main.ts`:
```typescript
app.enableCors({
  origin: 'http://localhost:3000',
  credentials: true
});
```

## Testing

Run the authentication test script:

```bash
node test-auth.js
```

Expected output:
```
🔐 Testing Authentication System

1️⃣ Testing login...
✅ Login successful!
   User: { id: '...', email: 'admin@sutramonitor.com', ... }
   Token: eyJhbGciOiJIUzI1Ni...

2️⃣ Testing protected endpoint...
✅ Protected endpoint accessible!
   User data: { id: '...', email: 'admin@sutramonitor.com', role: 'admin' }

...

✅ All authentication tests passed!
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'user',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  last_login_at timestamptz
);

CREATE INDEX idx_users_email ON users(email);
```

### Monitor Configs Relationship

```sql
ALTER TABLE monitor_configs 
ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
```

This allows each user to have their own configuration and watchlist.

---

For more information, see the main [README.md](../README.md).
