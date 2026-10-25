import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBm3-8scn3h6IrL-UDF30mmXGIhK7QQ_BI",
  authDomain: "margonem-bot-ba025.firebaseapp.com",
  projectId: "margonem-bot-ba025",
  storageBucket: "margonem-bot-ba025.firebasestorage.app",
  messagingSenderId: "787435244489",
  appId: "1:787435244489:web:8ecb575a76054dc55b7618"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

signInAnonymously(auth).catch(console.error);
