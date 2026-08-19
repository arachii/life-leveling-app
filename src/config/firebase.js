import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref } from "firebase/database";

const connection = {
  apiKey: "AIzaSyAaUE_5mGR7FJsEqjmyFeZPasWfxlEIN3o",
  authDomain: "life-leveling-app-shared.firebaseapp.com",
  databaseURL: "https://life-leveling-app-shared-default-rtdb.firebaseio.com",
  projectId: "life-leveling-app-shared",
  storageBucket: "life-leveling-app-shared.firebasestorage.app",
  messagingSenderId: "337807533967",
  appId: "1:337807533967:web:d3a8ce10f55e0fd7d50dfa"
};

const app = initializeApp(connection);

export const authClient = getAuth(app);
export const databaseClient = getDatabase(app);
export const sharedStateRef = ref(databaseClient, "lifeVillage15/shared/main");
export const backupRootRef = ref(databaseClient, "lifeVillage15/backups");