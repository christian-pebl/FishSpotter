
import admin from 'firebase-admin';

// This is a server-only file. 

// Ensure you have the GOOGLE_APPLICATION_CREDENTIALS environment variable set
// with the path to your service account key file.
// You can download this from the Firebase console: Project Settings > Service accounts.
const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
);


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'critterpedia-lgrlq.appspot.com',
  });
}

const adminDb = admin.firestore();
const adminStorage = admin.storage();

export { adminDb, adminStorage };
