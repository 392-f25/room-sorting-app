# Firebase Setup Guide

To run this project locally, you need to connect it to your own Firebase project.

## 1. Create a Firebase Project

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click **"Add project"** and follow the steps to create a new project.
3.  Once your project is created, click the **Web icon (`</>`)** on the dashboard to add a web application.
4.  Give the app a nickname and click **"Register app"**.
5.  After registering, Firebase will display your `firebaseConfig` object. You will need these credentials in the next step.

## 2. Set Up the Realtime Database

1.  In the Firebase Console, go to **Build > Realtime Database** in the left-hand menu.
2.  Click **"Create database"**.
3.  Choose a location for your database.
4.  Select **"Start in test mode"**. This will allow read/write access for development.

## 3. Configure Your Environment Variables

Your Firebase project credentials should be stored in an environment file, not committed to source control.

1.  In your terminal, at the root of this project, rename the example environment file by running the following command:

    ```bash
    mv .env.example .env
    ```

2.  Now, open the newly created `.env` file. It will look like this:

    ```
    VITE_FIREBASE_API_KEY=""
    VITE_FIREBASE_AUTH_DOMAIN=""
    VITE_FIREBASE_DATABASE_URL=""
    VITE_FIREBASE_PROJECT_ID=""
    VITE_FIREBASE_STORAGE_BUCKET=""
    VITE_FIREBASE_MESSAGING_SENDER_ID=""
    VITE_FIREBASE_APP_ID=""
    ```

3.  Go back to the Firebase console page with your `firebaseConfig` object and copy each value into the corresponding variable in your `.env` file.

## 4. Security Rules

1.  This project contains a `database.rules.json` file with the necessary security rules for development. Open this file and copy its contents.
2.  In the Firebase Console, navigate back to your **Realtime Database** and click on the **Rules** tab.
3.  Paste the rules found in `database.rules.json`

## 5. Run the Application

Now, install the project dependencies and start the development server.

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run the app:
    ```bash
    npm run dev
    ```
