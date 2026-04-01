# Book Server Interface

A React Native (Expo) mobile app for:
- Reading ebooks, PDFs, and comics from your self-hosted [Kavita](https://www.kavitareader.com/) server
- Listening to audiobooks and podcasts from your self-hosted [AudioBookShelf](https://www.audiobookshelf.org/) server

## Features

- 📚 **Browse Libraries** — View all your Kavita libraries and series in a beautiful grid
- 📖 **EPUB Reader** — Full epub.js-powered reader with dark/sepia/light themes, swipe to turn pages, and reading progress sync
- 📄 **PDF Reader** — PDF.js-powered reader that renders all pages inline with smooth scrolling
- 🔍 **Search** — Full-text search across all your Kavita series
- 📊 **Reading Progress** — Progress synced back to your Kavita server in real-time
- 🔐 **Secure Auth** — API key stored securely in device's secure enclave

## Screenshots

The app uses a dark amber/gold theme designed for comfortable reading sessions.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Expo Go](https://expo.dev/go) app on your Android/iOS device **OR** Android Studio / Xcode for a full build
- A running [Kavita server](https://www.kavitareader.com/) (v0.7+)

---

## Setup

### 1. Install dependencies

```bash
cd kavita-reader
npm install
```

### 2. Add placeholder assets

You need three image files in the `assets/` folder before running:

```bash
# Quick way: copy any PNG as placeholders
cp any-image.png assets/icon.png
cp any-image.png assets/splash.png
cp any-image.png assets/adaptive-icon.png
```

Or generate proper icons with a tool like [EasyAppIcon](https://easyappicon.com/).

### 3. Start the development server

```bash
npx expo start
```

Then:
- **Physical device**: Scan the QR code with [Expo Go](https://expo.dev/go)
- **Android emulator**: Press `a` in the terminal
- **iOS simulator**: Press `i` in the terminal

### 4. Connect to your Kavita server

On first launch, enter:
- **Server URL**: e.g. `http://192.168.1.100:5000` or your Tailscale/domain URL
- **API Key**: Found in Kavita → User Settings (⚙️ gear icon) → Security → API Key

---

## Building a Release APK (Android)

To build a standalone APK you can install directly:

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo account (free)
eas login

# Configure the project
eas build:configure

# Build APK for Android
eas build --platform android --profile preview
```

For a local build without Expo's servers:

```bash
# Requires Android Studio and Java 17 installed
npx expo run:android
```

---

## Project Structure

```
kavita-reader/
├── app/
│   ├── _layout.tsx          # Root layout with auth routing
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx        # Server URL + API key login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigation
│   │   ├── index.tsx        # Home (recently read + library overview)
│   │   ├── libraries.tsx    # Browse all libraries & series
│   │   ├── search.tsx       # Search across all series
│   │   └── settings.tsx     # Server settings + disconnect
│   ├── series/
│   │   └── [id].tsx         # Series detail (volumes & chapters)
│   └── reader/
│       ├── pdf.tsx          # PDF reader (PDF.js via WebView)
│       └── epub.tsx         # EPUB reader (epub.js via WebView)
├── components/
│   └── SeriesCard.tsx       # Grid card + list card components
├── constants/
│   └── theme.ts             # Colors, typography, spacing
├── contexts/
│   └── AuthContext.tsx      # Auth state + login/logout
├── services/
│   └── kavitaAPI.ts         # Full Kavita REST API client
├── app.json                 # Expo config
├── babel.config.js
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## Kavita API Notes

This app uses the **Kavita Plugin API** for authentication (`/api/Plugin/authenticate`), which accepts your API key and returns a JWT token used for all subsequent requests. This is the recommended approach for third-party clients.

Key endpoints used:
| Endpoint | Purpose |
|---|---|
| `POST /api/Plugin/authenticate` | Get JWT token from API key |
| `GET /api/Library` | List all libraries |
| `POST /api/Series/all` | Paginated series list |
| `GET /api/Series/{id}` | Series metadata |
| `GET /api/Series/volumes` | Volumes + chapters |
| `POST /api/Reader/progress` | Save reading progress |
| `GET /api/Reader/pdf` | Stream PDF file |
| `GET /api/Reader/epub` | Stream EPUB file |
| `GET /api/Search/search` | Full-text search |

---

## Troubleshooting

**"Could not reach server"**
- Make sure your phone and server are on the same network (or use Tailscale/VPN)
- Try the IP address directly instead of a hostname
- Check that Kavita is running and accessible from a browser

**"Invalid API key"**
- Navigate to Kavita → click your avatar → User Settings → Security
- Copy the full API key (it's a long string)

**EPUB not loading**
- epub.js fetches the file via XHR with an Authorization header from inside a WebView
- Some older Kavita versions may have CORS restrictions — ensure your Kavita is v0.7+

**PDF renders blank**
- Verify the PDF URL works in a browser: `http://YOUR_SERVER/api/Reader/pdf?chapterId=X&apiKey=YOUR_KEY`

---

## Tech Stack

- **React Native** + **Expo** (SDK 51)
- **Expo Router** (file-based navigation)
- **epub.js** (EPUB rendering via WebView)
- **PDF.js** (PDF rendering via WebView)
- **expo-secure-store** (secure API key storage)
- **TypeScript** throughout

---

## License

MIT — use freely for your personal self-hosted setup.
