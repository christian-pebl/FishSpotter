
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "critterpedia-lgrlq",
  "appId": "1:380446974637:web:b00d91e48a61561c69dc24",
  "storageBucket": "critterpedia-lgrlq.appspot.com",
  "apiKey": "AIzaSyBhktPBPXF1i30r7JEHkE3LqOdg8E-nEa4",
  "authDomain": "critterpedia-lgrlq.firebaseapp.com",
  "messagingSenderId": "380446974637"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
