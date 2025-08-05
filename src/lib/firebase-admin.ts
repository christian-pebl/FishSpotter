
import admin from 'firebase-admin';

// This is a server-only file. 

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

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'critterpedia-lgrlq.appspot.com',
    });
};

export const getAdminDb = () => {
  initializeAdminApp();
  return admin.firestore();
};

export const getAdminStorage = () => {
  initializeAdminApp();
  return admin.storage();
};
