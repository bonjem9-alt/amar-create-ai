# Amar Create AI

A professional starter project for an AI-powered app builder. It generates source files from natural-language prompts, shows an HTML preview, stores recent projects in the browser, and exports generated projects as ZIP files.

## What is included

- Responsive builder UI for desktop and iPhone-sized screens
- Web, iOS, and Android target selection
- AI project generation through a server-side OpenAI API call
- File explorer, source viewer, copy-code action, and HTML preview
- ZIP export endpoint
- Local browser project history
- PWA manifest and Capacitor configuration for native packaging

## Requirements

- Node.js 20 or newer
- An OpenAI API key with API access and billing configured
- A hosting service that supports a Node.js server (for example, Render, Railway, or a VPS)

## Run locally

1. Install Node.js.
2. Unzip this project and open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file by copying `.env.example`.
5. Put your API key in `.env`:

   ```env
   OPENAI_API_KEY=your_real_key_here
   OPENAI_MODEL=gpt-4.1-mini
   PORT=8787
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:5173`.

The Vite development server proxies no API calls; for local development, run the UI on port 5173 and API on port 8787. If your browser cannot reach the API, add this to `vite.config.js` under `server`:

```js
server: {
  port: 5173,
  proxy: { "/api": "http://localhost:8787" }
}
```

## Production

Build and run:

```bash
npm run build
npm start
```

The Express server serves the built `dist` folder and the `/api` endpoints. Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `PORT` as environment variables in your hosting provider. Do not upload `.env` to GitHub.

## Android and iPhone packaging

The project is a responsive web app/PWA. Capacitor can wrap the same web build as native Android and iOS projects.

Install Capacitor:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
npm run mobile:sync
```

Native Android builds require Android Studio. Native iOS builds and App Store signing require macOS with Xcode. An iPhone alone can use the deployed PWA through Safari's **Share → Add to Home Screen**. For remote API access, deploy the Node server and configure the app's API base URL for your hosted domain before packaging.

## Important production work

This is a functional starter, not a hosted service. Before public launch, add user accounts, per-user project storage, usage limits, payment/billing if needed, rate limiting, request logging, abuse protection, and a proper isolated preview/runtime for generated code. The current preview runs generated HTML in a sandboxed iframe; do not treat it as a secure general-purpose execution environment. Keep API keys on the server only.

## Security

- Never place API keys in `src/` or variables prefixed with `VITE_`.
- Keep `.env` private and excluded from version control.
- Add authentication and rate limiting before allowing public use.
- Generated source code is untrusted. Review it before deployment.
