# Job Tracker

Modern Job Application Tracker built with React, Tailwind and Firebase.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with Vite vars:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

3. Run dev server:

```bash
npm run dev
```

Firestore structure (recommended)

users/{userId}
- profile
- applications (collection)
- reminders (collection)
- notifications (collection)
- resumes (collection)
- notes (collection)

Deployment: Vercel — set the same env vars in the project settings.

This repo contains a scaffold: auth, application CRUD, PWA manifest, Tailwind setup, and hooks to extend features like calendar, reminders, analytics, and resume uploads.
