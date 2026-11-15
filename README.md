# LUX ESCAPE

A React, TypeScript and Firebase-backed tourism platform for LUX ESCAPE, Ghana.

## Run locally

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and add the web app configuration from Firebase Console → Project settings → General → Your apps. In particular, `VITE_FIREBASE_API_KEY` must be the Firebase Web App `apiKey`; Cloudinary credentials are separate and cannot replace it. The Firebase web API key is client configuration, not a service-account secret.
3. In Firebase Authentication, enable Email/Password and Google providers. Add the local and production domains to Authorized domains.
4. Create a Cloud Firestore database and deploy `firestore.rules` and `firestore.indexes.json`.
5. Create a Cloudinary account. In Settings → Upload, create an **unsigned** upload preset restricted to image/video formats, with a 20 MB file-size limit. Set the destination folder in the preset itself if desired; the browser request intentionally sends only the file and preset name. Add the Cloudinary cloud name and preset name to `.env.local`.
6. Run `npm run dev`; use `npm run build` to produce the production bundle.

Without Firebase settings the public site remains viewable, but authentication, live trips, reservations, customer messages and the admin workspace are intentionally unavailable. No demo trips, reviews, bookings or analytics are fabricated.

## Admin access

The `/admin` workspace is restricted to the verified Firebase Authentication account whose email is `luxescape111@gmail.com`. There is no admin sign-up; the same account can sign into the public site, where its account page offers an Admin portal button. The button refreshes the Firebase identity token and verifies the account before navigating to `/admin`; Firestore rules enforce the same email allowlist and require a verified email. Update both the `ADMIN_EMAIL` constant in `src/App.tsx` and `isAdmin()` in `firestore.rules` together if the authorized account changes. Publish updated rules with `firebase deploy --only firestore:rules`.

## Data and reservation model

- `events`: published trip information, capacity and `reservedSeats`.
- `bookings`: one reservation per customer per event, addressed as `{uid}_{eventId}`.
- `users`: non-secret customer profile fields and signed-in visit totals. Visit totals increment once per authenticated browser tab session and stream live into the admin Users panel; anonymous visits are not attributed to accounts.
- `conversations/{id}/messages`: persistent, real-time support messages.
- `websiteContent/{slotId}`: administrator-managed homepage and brand image slots. Hero slide records also store their eyebrow, headline, emphasized headline and description. Homepage Memories preview cards use numbered `experience-{n}` records with their category, title, location and image. Add or remove additional preview cards from the Website images section in `/admin`; new cards appear publicly after their image is uploaded.
- `galleryAlbums/{albumId}`: published memory playlists with a title, trip location, description and preview image.
- `galleryMedia/{mediaId}`: published photos and videos assigned to a playlist and displayed on its `/memories/{albumId}` page. Older unassigned memories remain grouped under an “Earlier memories” playlist.

The admin portal has responsive sections for event/trip covers, registered users, website images and Memories playlists. The Users panel displays the live registered-account total, expandable profile names/emails and signed-in visit counts. Create a playlist with its own preview image, then select that playlist when uploading photos or videos; the playlist and media file are the only required upload fields. Uploaded filenames are not shown as titles or captions in the Memories gallery. Existing unassigned memories can be moved into a playlist. The public Memories tab shows the playlists, and opening one displays its published media at its original aspect ratio without cropping or saved framing. Website and event cover photos retain their separate crop/framing previews. Images and videos are uploaded directly from the browser to Cloudinary using the configured unsigned upload preset; media uploads are limited to files smaller than 20 MB in the app, and only the verified allowlisted Firebase Authentication account can save or manage the corresponding Firestore content. Public pages show only published playlists and media. The unsigned preset is public by design, so restrict its allowed formats and file size in Cloudinary. Replacing, resetting or removing media updates the website/Firestore record but does not delete the Cloudinary asset; clean up unused assets in the Cloudinary Media Library. Secure programmatic deletion would require a trusted server-side endpoint and Cloudinary API secret. Existing Firebase Storage URLs are not copied automatically; replace those files with Cloudinary uploads if they become unavailable.

Published website images and editable copy are cached in the visitor’s browser so customized content can render before the live Firestore listener reconnects. Administrators can edit each hero slide’s eyebrow, headline, emphasized headline and description, plus each homepage Memories preview card’s category, title and location in the Website images cards. The Website images panel includes inline add controls after the current hero and Memories cards; added slides/cards are published after their image and text are saved, and extras can be removed from the same panel. The homepage hero can be navigated with its arrows and indicators or by swiping/dragging horizontally; vertical page scrolling remains available on touch screens. The Memories preview is an auto-advancing 3D carousel with touch/mouse swipe, horizontal touchpad or Shift+wheel input, previous/next and pause controls; it pauses while hovered or focused and respects reduced-motion preferences. Its cards link to the playlist gallery. The Memories navigation link opens the playlist gallery, with a dedicated page for each playlist’s published photos and videos.

Reservations run in a Firestore transaction. Rules require an atomic event-capacity increment and matching pending/unpaid booking, enforce the capacity ceiling, and prevent a customer creating a duplicate reservation for the same event. A booking is only a request; it is not shown as confirmed or paid. Payment provider integration and server-side payment verification must be added before collecting or recording payments.

Public content collections are designed for admin-managed publishing. The initial site deliberately has no fabricated trip listings or testimonials; an administrator can publish trips from `/admin`.

## Deployment and service setup

- On Render, deploy this repository as a **Static Site**, not a Web Service. The root `render.yaml` defines the `npm ci && npm run build` command, publishes `dist`, and rewrites client-side routes to `index.html`. If a Web Service already exists for this repository, create a Static Site from the Blueprint or select **Static Site** when creating the service; a Web Service will continue to run its configured start command.
- Render Static Sites are served from its CDN and do not spin down due to inactivity, so a keep-awake ping is unnecessary. Client-side code cannot ping while no visitor has the site open. If deploying a separate sleeping Web Service instead, configure an external uptime monitor for that service URL.
- Set Firebase configuration in the hosting provider's environment variables (the `VITE_` values are public web-app configuration, not service-account credentials).
- Deploy Firestore rules and indexes with the Firebase CLI: `firebase deploy --only firestore:rules,firestore:indexes`.
- Enable Firebase App Check for production and configure an appropriate reCAPTCHA provider.
- Set up a trusted Admin SDK workflow for custom claims. Never ship service-account keys or payment secrets to the browser.
- Configure payment processing with a Ghana-supported gateway through a server-side Cloud Function before accepting funds.
- Replace the example email and image URLs with brand-approved content before launch.

The `events`, booking and chat flows are wired to Firestore. Gallery upload/content management, payments, full analytics/reporting, customer profile editing and production Cloud Functions still need implementation/configuration before the platform should be treated as launch-complete.
