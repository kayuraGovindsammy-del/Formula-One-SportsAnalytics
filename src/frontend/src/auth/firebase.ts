import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnqvmX575rW3vuSE4cgWV-YAeI9mois0s",
  authDomain: "sports-analytics-f1.firebaseapp.com",
  projectId: "sports-analytics-f1",
  appId: "1:754958851474:web:669ea55cbce9ed9b1bf54b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);