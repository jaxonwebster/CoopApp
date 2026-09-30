# Coop setup notes

## Start the app
1. Open this folder in VS Code.
2. Use Node.js 20 LTS (the Functions package is pinned to Node 20), then run `npm install`.
3. Confirm the `.env` file is beside `package.json` and contains all `EXPO_PUBLIC_FIREBASE_*` values before starting the app.
4. Run `npx expo start -c`.
5. Open Expo Go on your phone and scan the QR code. Keep the computer and phone on the same network. If LAN discovery fails, try `npx expo start --tunnel`.

Expo Go is useful for checking screens and Firestore, but push notifications, app-icon badges, and the final iOS behavior must be tested in an EAS development/preview/production build on a physical device.

## Firebase Storage for profile photos
The app code already uploads profile photos to `profiles/{userId}/...` and saves the resulting download URL in `users/{userId}.profilePhotoUrl` in Firestore.

1. In Firebase Console, open your Coop project.
2. Go to Build > Storage and create/enable the default Storage bucket if it is not enabled yet.
3. Confirm `.env` has the bucket shown by Firebase as `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`.
4. From this project folder, sign in to the Firebase CLI if needed: `firebase login`.
5. Deploy the included Storage rules: `firebase deploy --only storage`.
6. Restart Expo with `npx expo start -c` after changing `.env`.

The included `storage.rules` allow a signed-in user to upload an image only to their own `profiles/{userId}` folder, with an 8 MB size limit.

## Firestore read-efficiency update
This version keeps the same screens and behavior while reducing repeated reads. Notifications listen for the newest 10 records, the active chore and approval badges use narrower listeners, and simultaneous household loads share one request.

After unzipping this version, deploy the included Firestore rules and indexes once from the app root:

```bash
firebase login
firebase use coop-49927
firebase deploy --only firestore
```

The read-efficiency changes themselves do not require a Functions deployment, but this updated round does: it adds the 7 AM recurring-chore reminder, locks historical streak results, and cleans up stale unclaimed optional occurrences. Deploy the included Functions after installing their dependencies:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Recurring chores
Recurring chores depend on the Firebase Cloud Functions in `functions/index.js`. The app calls `ensureRecurringChores` whenever household chores load, and `createDueRecurringChores` also runs on a daily schedule. This is backend behavior; installing an Android/Expo package will not fix it.

Deploy/update the backend with:
1. `firebase login`
2. `firebase use` and confirm the correct Coop Firebase project is selected.
3. From the app root, run `firebase deploy --only firestore:rules,storage,functions`.

Scheduled Cloud Functions require Firebase/Google Cloud billing to be enabled for the project. The on-demand `ensureRecurringChores` callable is also included so opening the app can create today's missing recurring occurrence after the functions are deployed.

Notification category preferences are stored on each user profile. After changing the notification settings page or notification behavior, redeploy Functions and Firestore rules so push filtering and family encouragement work for every account.

## iOS/TestFlight build
1. Install EAS CLI if needed: `npm install --global eas-cli`.
2. Run `eas login`.
3. Make sure the production EAS environment contains the same `EXPO_PUBLIC_FIREBASE_*` variables as `.env`. These values are bundled at build time; missing values can cause a TestFlight build to open to a blank screen.
4. Run `npx expo-doctor` and fix any reported package mismatch before building.
5. Build: `eas build --platform ios --profile production`.
6. Submit the finished build: `eas submit --platform ios --profile production`.

If a TestFlight build is blank, first verify that `npm install` completed successfully, the EAS production environment has the Firebase variables, and the build was created after the latest source changes. Then rebuild with the production profile; clearing Metro with `npx expo start -c` only affects local development, not an already-uploaded TestFlight binary.

## Notification test checklist
Use two physical devices/accounts in the same household after deploying Functions. Test assignment to a child, completion by the child, approval-required completion, a missed due date, privilege expiration, and the “Pat on the back” action. Each notification should display `Coop` as the title. If no push arrives, check device notification permissions, the saved Expo push token, and `firebase functions:log`.

## Android Studio cleanup
There was no Android Studio-only npm dependency in `package.json`, and this project has no generated `android/` native project. Android Studio itself is installed outside this app folder. I removed local `.idea/`, `.expo/`, `node_modules/`, and `firebase-debug.log` artifacts from this copy and added the local cache/log entries to `.gitignore`. Run `npm install` after unzipping to restore dependencies.
