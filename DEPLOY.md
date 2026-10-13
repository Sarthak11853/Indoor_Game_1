# Deploying Haunted Village (free)

The whole game is **one Node.js web service**: it serves the phone app and runs the live
game over WebSockets. Rooms live in the server's memory, so run exactly **one instance**.

You need an **https** address for real play: Android's card reader (Web NFC) only works on
https, and the address is written onto your NFC cards, so it should never change.

---

## Option A: Render free web service (recommended)

Gives you a permanent `https://<name>.onrender.com` address for free.

### 1. Put the code on GitHub's main branch

Merge the pull request into `main` (or remember to pick the `Trial1` branch in step 2).

### 2. Create the service from the Blueprint

The repository contains `render.yaml`, which describes everything.

1. Sign in at <https://dashboard.render.com> (you can sign in with GitHub).
2. Click **New → Blueprint**.
3. Connect GitHub if asked, then choose the **Indoor_Game_1** repository (and branch).
4. Click **Apply**. Render installs, builds and starts the game. The first build takes a
   few minutes.
5. Open the service and copy its address, e.g. `https://haunted-village.onrender.com`
   (Render adds a suffix if the name is taken).

Check it works: `https://<your-address>/health` should show `{"ok":true}`.

<details>
<summary>Prefer to click through without the Blueprint?</summary>

**New → Web Service**, pick the repository, then:

| Field | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |
| Instance type | Free |
| Environment variable | `NODE_VERSION` = `22` |

</details>

### 3. Play

Open your address on the host's phone and create a room. The QR code and share link
automatically use your Render address (the server reads Render's `RENDER_EXTERNAL_URL`).

### 4. Make your NFC cards

1. On an **Android phone with Chrome**, open `https://<your-address>/admin/cards`.
2. Check the "Game address stored on the card" box shows your Render address.
3. Press **Write a new card** and hold a blank NFC tag (NTAG213/215/216) to the back of
   the phone. Repeat for every charm (one per player) and a few relics.

No Android phone? The page can generate card links instead; write each one as a
**URL record** with an NFC app such as "NFC Tools".

### Good to know about the free plan

- **It sleeps when idle.** After 15 minutes with no visits and no game traffic, the
  service sleeps; the next visit wakes it in about a minute. A match in progress keeps it
  awake. Tip: open the site a minute before game night.
- **Free hours.** Render gives a monthly allowance of free instance hours per workspace,
  enough for one service.
- **Redeploys and restarts end running games.** Rooms are kept in memory. Players will see
  "Your seat in this room is gone"; just create a new room.
- **Updating:** push to the deployed branch and Render redeploys automatically. Avoid
  pushing in the middle of a game night.

### Using your own domain (optional)

1. In Render: your service → **Settings → Custom Domains** and follow the DNS steps.
2. Add the environment variable `PUBLIC_URL` = `https://your.domain` (service →
   **Environment**), so QR codes use it.
3. Write your NFC cards **after** this, so they carry the custom domain.

---

## Option B: your own computer + a free tunnel (quick test, no account)

Good for trying real NFC cards or a one-off game night. The address changes every time,
so **don't write permanent cards with it**.

```bash
npm install
npm run build
npm start                                      # game on http://localhost:3001
cloudflared tunnel --url http://localhost:3001 # in a second terminal
```

`cloudflared` is Cloudflare's free tunnel tool ([install guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)).
It prints an `https://….trycloudflare.com` address: open that on every phone, including
the host's. Your computer must stay awake and online during the game.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| QR code shows the wrong address | Set `PUBLIC_URL` to the address phones should use. |
| No "Enable card reader" button on Android | Use Chrome, and open the game over **https**. |
| iPhone tap opens Safari but says "Join a game on this phone first" | That player joined from a home-screen icon. On iPhone, play in Safari. |
| "Your seat in this room is gone" | The server restarted or the room expired. Create a new room. |
| First visit takes ~1 minute | The free service was asleep. It's awake now. |
| Card does nothing | Check it at `/admin/cards` → **Check a card**; it must contain your current address. |
