# TarasLearn LMS

A modern Learning Management System (LMS) for engineering education, rebuilt with a clean, production-ready architecture.

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + Mongoose (MongoDB)
- **Auth:** JWT + bcrypt (server-side, secure)
- **Code Lab:** Runs Python / C / C++ / Java via a remote sandbox (Piston or Judge0)

## Features

- Role-based access: Administrator, Teacher, Student
- Course catalog, course creation/editing/deletion, level filters
- College -> Department -> Course access control
- Content library with video & document upload/streaming
- Hands-on code editor (Python, C, C++, Java)
- Quizzes and progress tracking
- Bulk user enrollment from Excel/CSV
- Interactive India student-location map
- Admin dashboard with KPIs and rule-based assistant

## Project structure

```
lms/
  client/   # React + Vite frontend
  server/   # Express + Mongoose backend
```

## Getting started

### Prerequisites

- Node.js 18+ (tested on Node 20)
- A running MongoDB instance (local or MongoDB Atlas)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy and edit the example environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set your `MONGODB_URI` and a strong `JWT_SECRET` in `server/.env`.

### 3. Seed the database (optional)

Creates the default admin account and starter courses:

```bash
npm run seed
```

Defaults (change these after first login):
- Admin email: `admin@taraslearn.local`
- Admin password: `Admin@12345`

### 4. Run the development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run frontend + backend with live reload |
| `npm run dev:server` | Run only the backend |
| `npm run dev:client` | Run only the frontend |
| `npm run build` | Build the frontend for production |
| `npm run seed` | Seed the database |
| `npm start` | Run the backend in production (requires built client) |

## License

Proprietary — all rights reserved.


Testing purpose and demo purpose we can use this below details : 

all data should need to in the monogodb before testing:


Connected to MongoDB
Created admin account: admin@taraslearn.com / Admin@12345
Courses: 6 inserted, 0 already present
Seed complete.


teacher
user: teacher@gmail.com
Pass : teacher@gmail.com

student:
user:"tripdaries01@gmail.com" 
Pass: Krishna@1234


College admin: college.admin@demo.edu / College@2026
Teacher: teacher@demo.edu / Teacher@2026
Student: student@demo.edu / Student@2026
Super admin: admin@taraslearn.com / Admin@12345