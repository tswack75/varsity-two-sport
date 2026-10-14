# Publish Varsity to GitHub Pages

Varsity is a static site. GitHub Pages does not need `npm start`, Node, or a build step.

1. In the currently installed Varsity app, open **Settings → Export all data** and keep that backup somewhere private.
2. Open the **existing** `varsity-two-sport` repository on GitHub. Choose **Add file → Upload files**, and upload the updated site files from this folder to the repository root: `index.html`, `app-simple.js`, `tracker.js`, `core.js`, `analytics.js`, `strength.js`, `strength-ui.js`, `progression.js`, `progression-simple.js`, `storage.js`, `style.css`, `sw.js`, `manifest.webmanifest`, and `icon.svg`. Upload these together so the offline cache can install the new version. The README, tests, package file, old `app.js`, `career.js`, `schedule.js`, and local server are optional. Keep `index.html` at the root, not inside an uploaded `two-sport` folder.
3. Commit the upload. Keep the existing GitHub Pages branch, repository name, and URL.
4. Open the existing Pages URL in Safari while online and refresh it. Once the three-tab interface appears, reopen the existing Home Screen app. Your stored data should remain on that device.

Do not upload a Health Quest export, Varsity backup, or other personal health data to the GitHub repository. These files are for import inside the app after you open it. Data stays in the browser on the device where you import it. Importing on an iPhone does not automatically populate another device.

To publish future updates, upload the changed site files to the same repository and commit them. GitHub Pages republishes the branch. Visit the site in Safari online once to refresh the service worker, then reopen the Home Screen app. Keep the repository name and site URL stable to preserve the installed app's storage identity.
