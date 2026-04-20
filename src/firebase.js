import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA-aJUNtWV2FfP11BdY1lAZc5t4v1Iv9vY",
  authDomain: "dailytracker-f56f7.firebaseapp.com",
  projectId: "dailytracker-f56f7",
  storageBucket: "dailytracker-f56f7.firebasestorage.app",
  messagingSenderId: "45135074457",
  appId: "1:45135074457:web:7aedaffab86989fe94d408"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
