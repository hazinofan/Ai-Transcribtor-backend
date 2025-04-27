# Transcription App Backend - Firebase Functions

Ceci est la partie backend de l'application de transcription YouTube, déployée en **Firebase Functions**.

---

## Technologies utilisées
- Firebase Functions
- TypeScript
- yt-dlp (extraction audio YouTube)
- ffmpeg (traitement de l'audio)
- Google Gemini API ou OpenAI Whisper API pour la transcription
- API de traduction

---

## Instructions d'installation

### 1. Cloner le dépôt
```bash
git clone https://github.com/your-username/transcription-backend.git
cd transcription-backend/functions

2. Installer les dépendances
npm install

Configurer les variables d'environnement:
GOOGLE_API_KEY=ta-cle-api
GEMINI_API_KEY=ta-cle-api


Développement local :
firebase emulators:start --only functions


Déploiement :
firebase deploy --only functions


📂 Structure du projet:
/functions
  /src
    processVideo.ts
  package.json
firebase.json
.firebaserc
/tracking
  /week_1.md

---- Suivi d'avancement ----
Voir les fichiers /tracking/week_x.md pour le suivi hebdomadaire
