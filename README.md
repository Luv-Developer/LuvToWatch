# LuvToWatch

An animated, responsive React app for private watch parties.

## Features

- Home page with product explanation and visual glassmorphism style
- Google sign-in with Supabase authentication
- Authenticated creator dashboard to create private room keys
- Guest room join via share link (no sign-in required for invited users)
- Real-time room updates:
  - synced video URL loading, play, pause, and seek
  - side chat panel
  - participant list
  - admin actions (kick and mute)
  - microphone voice chat (WebRTC signaling over Supabase Realtime)

## Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - copy `.env.example` to `.env`
   - set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. In Supabase SQL editor, run `supabase-schema.sql`
4. In Supabase dashboard:
   - enable Google provider in Authentication > Providers
   - add your local/dev URL in Authentication > URL configuration
   - enable Realtime for your project
5. Run app:
   - `npm run dev`

## Routes

- `/` home page
- `/signin` Google sign-in page
- `/dashboard` room creation page (protected)
- `/room/:roomKey` private room page (guest-accessible with valid key)
