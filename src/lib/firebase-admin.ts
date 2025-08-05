
import 'dotenv/config';
import admin from 'firebase-admin';

// This is a server-only file. 

let app: admin.app.App | undefined = undefined;

const initializeAdminApp = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add it to your .env file.');
    }

    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
    );

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'critterpedia-lgrlq.appspot.com',
    });
    return app;
};

export const getAdminDb = () => {
  if (!app) initializeAdminApp();
  return admin.firestore();
};

export const getAdminStorage = () => {
  if (!app) initializeAdminApp();
  return admin.storage();
};
