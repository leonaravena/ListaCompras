import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore - Ignoramos el falso positivo de tipado en React Native
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLrsUOg5LZ7ArkuV2c6tJg25uBjp82v00",
  authDomain: "listacomprasapp-e9144.firebaseapp.com",
  projectId: "listacomprasapp-e9144",
  storageBucket: "listacomprasapp-e9144.firebasestorage.app",
  messagingSenderId: "871728736804",
  appId: "1:871728736804:web:a5f2e710fb7bacc78586b1"
};
// 1. Inicializamos la app de forma segura sin usar 'let'
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Inicializamos la autenticación directamente en una constante
const auth = getApps().length === 0 
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

// 3. Exportamos todo
export const db = getFirestore(app);
export { auth };