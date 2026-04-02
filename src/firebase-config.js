// Firebase Configuration
// TODO: Replace with your project's config object from the Firebase Console
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
// Check if firebase is defined (it will be loaded via CDN in HTML)
if (typeof firebase !== 'undefined') {
    window.app = firebase.initializeApp(firebaseConfig);
    // 1. Initialize App Check FIRST
    if (firebase.appCheck) {
        if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        const k = import.meta.env.VITE_RECAPTCHA_KEY;
        window.appCheck = firebase.appCheck();
        window.appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(k),
            true
        );
        console.log("App Check activated (Admin)");
    }

    // 2. Initialize Services AFTER App Check
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();

    console.log("Admin Firebase services initialized with App Check");

    console.log("Firebase initialized globally");
} else {
    console.error("Firebase SDK not loaded");
}
