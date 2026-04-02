import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export { httpsCallable };

// Forzamos el uso de Long Polling para evitar errores de red (Fetch API / CORS)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache()
});

export const googleProvider = new GoogleAuthProvider();

// Solo sugerir la cuenta de administración
googleProvider.setCustomParameters({
  login_hint: 'escueladetangoventarron@gmail.com'
});

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user.email !== 'escueladetangoventarron@gmail.com') {
            await signOut(auth);
            throw new Error("No tienes permisos de administrador.");
        }
        return result.user;
    } catch (error) {
        throw error;
    }
};

export const logout = () => signOut(auth);
