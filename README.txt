ATTENDANCE TRACKER — Windows + Android PWA
============================================

Included:
- Period: 23 Jul 2025 to 31 Dec 2026
- Target attendance: 25% (editable)
- Working days: Monday–Saturday; Sundays excluded
- Add holidays manually by selecting a date and pressing "Mark holiday"
- Present / Absent marking, calendar, past edits, CSV export, backup/restore
- Local storage and optional Firebase cloud sync

INSTALL / USE
1. Extract this ZIP to a folder.
2. Open index.html in a modern browser to use it locally.
3. For installable PWA and reliable service-worker/offline behavior, serve the folder over HTTPS or localhost:
   - easiest: upload the folder to a static HTTPS host (e.g. GitHub Pages), or run a local static server.
4. Windows: open the hosted URL in Edge or Chrome and choose Install app.
5. Android: open the hosted URL in Chrome → menu → Add to Home screen / Install app.

CLOUD SYNC (optional; requires your own Firebase project)
1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Web app and copy its Firebase config JSON.
3. In Firebase Authentication → Sign-in method, enable Email/Password.
4. Create Firestore database.
5. Firestore rules for this personal tracker (restrict each user to their own document):
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /attendance/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
6. In app Settings, paste the Firebase web config JSON and Save.
7. Enter the same email/password on both devices. On one device choose Create account; on the other choose Sign in.
8. Open the same hosted app on both devices. Firebase authentication should persist the login in each browser.

IMPORTANT CLOUD SYNC NOTE
Cloud sync requires the same Firebase email/password account on both devices. The app stores attendance in a per-user Firestore document protected by the rules above. Firebase config is a normal web app config, but never use public read/write rules. This prototype stores the password in browser local storage for convenience; for production use, I recommend removing that and relying on Firebase's saved login session.

CALCULATION
- Eligible days = Monday–Saturday within the period, excluding dates marked Holiday.
- Required Present = ceil(eligible days × target percentage).
- Still needed = max(0, required Present − Present already recorded).
- Attendance percentage = Present / eligible days.
- “Still needed” is a total-period target calculation; it does not guarantee the target can still be reached if too many eligible days have already passed.

DATA
- Attendance data is stored in browser local storage until you configure cloud sync.
- Use Backup / restore regularly before clearing browser data.
