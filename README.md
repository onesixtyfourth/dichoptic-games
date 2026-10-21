---
title: Dichoptic Games
description: Games played as dichoptic exercises on a mobile phone, using coloured anaglyph glasses or a VR viewer
ms.date: 2026-10-21
keywords:
  - amblyopia
  - dichoptic
  - games
  - pwa
---

Games on your phone, set up as dichoptic exercises. Each eye sees a different part of the game, so the two eyes have to work together to play.

The first game is **Blocks**, a falling-block puzzle game.

> [!IMPORTANT]
> Play now at **<https://onesixtyfourth.github.io/dichoptic-games/>**

> [!CAUTION]
> This app is not a medical device. Use it only as directed by your orthoptist or eye-care professional, and follow their advice on contrast settings and session length.

## How it works

Blocks splits what you see between your two eyes:

| What you see                                   | Which eye sees it                           |
|------------------------------------------------|---------------------------------------------|
| Falling piece and the "next" preview           | Amblyopic (weaker) eye only, full contrast  |
| Stack of landed blocks                         | Fellow (stronger) eye only, reduced contrast |
| Board border, score, lines, level and timer    | Both eyes                                   |

To place pieces well you need information from both eyes at the same time. Lowering the contrast for the stronger eye stops it from dominating, which encourages the weaker eye to take part.

## What you need

* A phone with a modern browser (Chrome, Safari, Edge or Firefox)
* One of the following:
  * Red/blue, red/cyan or red/green anaglyph glasses
  * A VR phone viewer (for example Google Cardboard) plus a Bluetooth game controller or keyboard

## Getting started

1. Open <https://onesixtyfourth.github.io/dichoptic-games/> on your phone.
2. Optionally install it as an app:
   * On Android (Chrome), open the menu and choose **Add to Home screen** or **Install app**.
   * On iPhone (Safari), tap **Share** then **Add to Home Screen**.
3. Tap **Settings** and set your viewing mode, glasses colours, which side the red lens is on, and which eye is your amblyopic eye. Tap **Save**.
4. Tap **Check glasses** and confirm the colours match your glasses (see [Checking your glasses](#checking-your-glasses)).
5. Put your glasses on and tap **Play**.

Once installed, the app works offline. Settings are saved on your phone.

When you open the app with an internet connection it always loads the latest version. Without a connection it uses the last version it downloaded.

## Settings

| Setting                          | Description                                                                                                  |
|----------------------------------|--------------------------------------------------------------------------------------------------------------|
| Viewing mode                     | **Coloured glasses** for anaglyph glasses, or **Split screen (VR viewer)** for a headset                     |
| Glasses colours                  | Red/blue (default), red/cyan or red/green. Match the lenses you own                                          |
| Red lens is over the             | Left or right eye. Most glasses have red on the left                                                         |
| Amblyopic (weaker) eye           | The eye that receives the falling piece                                                                      |
| Fellow (stronger) eye contrast   | How visible the landed blocks are to the stronger eye (5% to 100%, default 40%)                              |
| Session length (minutes)         | Play time before the session ends automatically (default 30)                                                 |
| Starting level                   | Higher levels make pieces fall faster                                                                        |

### Choosing the contrast

Start with the contrast your orthoptist recommends. If you have no recommendation, lower the fellow-eye contrast until you can see both the falling piece and the landed blocks at the same time. As your vision improves, raise it gradually towards 100%.

You can pause the game, open **Settings**, change the contrast and resume without losing your game.

## Checking your glasses

**Check glasses** shows a circle to the left eye only and a square to the right eye only.

1. Close your right eye. You should see only the circle.
2. Close your left eye. You should see only the square.

If the shapes are swapped, change **Red lens is over the** in Settings. If you can faintly see the other shape (ghosting), try lowering your screen brightness or choosing a different **Glasses colours** option. A small cross in the middle is shown to both eyes.

## Controls

### Touch (coloured glasses mode)

| Button | Action                 |
|--------|------------------------|
| ◀      | Move left (hold to repeat)  |
| ⟳      | Rotate                 |
| ▶      | Move right (hold to repeat) |
| ▼      | Soft drop (hold to repeat)  |
| ⤓      | Hard drop              |
| ❚❚     | Pause                  |

In split-screen mode the on-screen buttons are hidden. Tapping the screen (or the button on a Cardboard viewer) pauses the game.

### Keyboard

| Key           | Action    |
|---------------|-----------|
| Left / Right  | Move      |
| Up            | Rotate    |
| Down          | Soft drop |
| Space         | Hard drop |
| P or Escape   | Pause     |

### Game controller

| Button                       | Action    |
|------------------------------|-----------|
| D-pad or left stick          | Move and soft drop |
| D-pad up or A                | Rotate    |
| B                            | Hard drop |
| Start                        | Play or pause |

## Sessions

The **TIME** counter shows how long is left in the current session. It only counts down while you are playing. When it reaches zero the game stops and shows your score. Pressing **Play** after that starts a fresh session.

The game also pauses automatically if you switch apps or lock the phone, and keeps the screen awake while you play.

## Split screen (VR viewer) mode

1. Pair a Bluetooth game controller or keyboard with your phone.
2. Select **Split screen (VR viewer)** in Settings and tap **Save**.
3. Tap **Play**. The game goes full screen and switches to landscape where the phone allows it.
4. Place the phone in the viewer.

The left half of the screen is shown to the left eye and the right half to the right eye. Pieces keep their normal colours in this mode.

## Running locally

The app is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static web server, for example:

```powershell
py -m http.server 8080
```

Then open `http://localhost:8080`. Offline support and screen wake lock need HTTPS (or `localhost`), so use the GitHub Pages address when playing on a phone.

## Files

| File                   | Purpose                                     |
|------------------------|---------------------------------------------|
| `index.html`           | Page layout, menus and settings form        |
| `style.css`            | Styling                                     |
| `app.js`               | Game logic, dichoptic rendering and input   |
| `sw.js`                | Service worker for offline use              |
| `manifest.webmanifest` | App manifest for installing to home screen  |
| `icon.svg`             | App icon                                    |
