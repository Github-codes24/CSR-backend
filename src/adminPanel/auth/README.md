# Admin authentication API

This module is isolated under `src/adminPanel/auth` and exports an Express router from `routes/authRoutes.js`. The current `server.js` does not mount application routers. To expose these endpoints, mount the exported router at `/api/admin/auth` in the app bootstrap when integration is allowed. JSON request parsing (`express.json()`) must be enabled by the host app.

## Configuration

- Set `ADMIN_AUTH_SECRET` to a long, random secret before starting the application. Tokens are signed with this key and expire after 8 hours.
- Admin accounts are provisioned through the database; this module intentionally has no public admin signup endpoint. Store `passwordHash` using the `hashPassword` export from `utils/crypto.js`.
- The starter project has no email delivery service. In non-production mode, `forgot-password` returns `devOtp` for local development. In production the OTP is generated and stored but needs an email provider integration to reach the admin; the generic response does not expose whether an account exists.
- Mount rate limiting at the host application or API gateway for login and OTP endpoints before production use.

All responses use `{ success, message?, data? }`; validation errors use HTTP 400, invalid credentials/token use 401, and OTP attempt limits use 429.

## Endpoints

Base path: `/api/admin/auth`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/login` | Verifies admin email and password; returns an 8-hour bearer token and admin profile. |
| POST | `/forgot-password` | Issues a 6-digit OTP for an active admin account; response is generic to avoid account discovery. |
| POST | `/verify-otp` | Checks the OTP and marks the password reset challenge verified. |
| POST | `/reset-password` | Resets the password using the verified OTP. |
| POST | `/change-password` | Changes the signed-in admin's password; requires a bearer token. |
| GET | `/me` | Returns the signed-in admin's basic profile; requires a bearer token. |

## Request examples

```json
{ "email": "admin@example.com", "password": "your-password" }
```

```json
{ "email": "admin@example.com" }
```

```json
{ "email": "admin@example.com", "otp": "123456" }
```

```json
{ "email": "admin@example.com", "otp": "123456", "newPassword": "new-password" }
```

```json
{ "currentPassword": "old-password", "newPassword": "new-password" }
```

For protected routes send `Authorization: Bearer <token>`.
