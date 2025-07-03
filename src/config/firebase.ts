
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyADXsd9RRb5EUk_JLXVspcTWaNi0b2Zck0",
  authDomain: "avl-telecom.firebaseapp.com",
  projectId: "avl-telecom",
  storageBucket: "avl-telecom.appspot.com",
  messagingSenderId: "54473960749",
  appId: "1:54473960749:web:04c60eb4d2b696d09bf7a4",
  measurementId: "G-Q2LX2KYYZ6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default {db, auth, storage, googleProvider};
//         <div className="flex items-center justify-between">