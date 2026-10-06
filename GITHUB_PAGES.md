# Publish Varsity to GitHub Pages

Varsity is a static site. GitHub Pages does not need `npm start`, Node, or a build step.

1. On GitHub, create a **new repository** named `varsity-two-sport`. A public repository is simplest. Keep it separate from Health Quest.
2. Open the repository, choose **Add file → Upload files**, and upload the **contents** of this `two-sport` folder to the repository root. The essential site files are `index.html`, `app.js`, `core.js`, `analytics.js`, `career.js`, `strength.js`, `strength-ui.js`, `progression.js`, `storage.js`, `schedule.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icon.svg`, and `.nojekyll`. The README, tests, package file, and local server are optional. Make sure `index.html` is at the root, not inside an uploaded `two-sport` folder.
3. Commit the upload. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, `main`, and `/(root)`, then **Save**.
4. When Pages shows the published URL, open `https://YOUR-USERNAME.github.io/varsity-two-sport/` in Safari on your iPhone.
5. In Safari, tap **Share → Add to Home Screen**, turn on **Open as Web App** if shown, then tap **Add**.
6. Launch Varsity from the new icon. At the welcome screen, choose **Import Health Quest history** and select your JSON export. Alternatively, import it later in **Settings**.

Do not upload a Health Quest export, Varsity backup, or other personal health data to the GitHub repository. These files are for import inside the app after you open it. Data stays in the browser on the device where you import it. Importing on an iPhone does not automatically populate another device.

To publish future updates, upload the changed site files to the same repository and commit them. GitHub Pages republishes the branch. Visit the site in Safari online once to refresh the service worker, then reopen the Home Screen app. Keep the repository name and site URL stable to preserve the installed app's storage identity.
