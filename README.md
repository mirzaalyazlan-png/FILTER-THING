# FaceFX Studio ✨

**Your face. Your style. Your effects.**

A fully functional, modern face filter web application inspired by Snapchat and TikTok, built purely with **HTML5, CSS3, and vanilla JavaScript**, powered by **MediaPipe FaceMesh** for real-time client-side face landmark detection and tracking.

---

## 🌟 Key Features

### 🎨 Design & User Experience
- **Modern Dark Aesthetic**: Styled with deep violet/indigo gradients (`#090812`, `#7e22ce`, `#0891b2`), glowing glassmorphism cards, and fluid transitions.
- **Responsive Layout**: Designed for seamless use on smartphones, tablets, and widescreen desktop monitors.
- **Snapchat & TikTok-style Controls**: Giant circular capture shutter button with glowing pulse feedback and a smooth horizontal filter carousel.

### 📸 Camera & Tracking Capabilities
- **Real-Time 3D Face Tracking**: Leverages MediaPipe's 468+ facial landmarks via WebAssembly and WebGL to track head rotation, tilt, eye positions, mouth movements, and facial contours in real time.
- **Start Camera Permission Gate**: Prompts user consent before camera initialization; camera frames are processed 100% locally on your device.
- **Front & Rear Camera Flip**: Switch between front (selfie) and back cameras when supported.
- **Mirror Preview Mode**: Instant toggle between mirrored (selfie) view and true perspective.
- **Virtual Demo Mode Fallback**: Built-in interactive demo portrait mode so you can test all 10 filters even on devices without a webcam!

### ✨ 10 Interactive Face Filters
1. 🐱 **Cat Ears & Cute Cat Nose**: Fluffy curved cat ears with pink inner tufts, sweet heart-shaped nose, 3D cheek whiskers, and rosy blush.
2. 🐶 **Puppy Ears & Dog Nose**: Floppy caramel ears with dynamic bounce, realistic button puppy nose with nostrils and specular gloss, and a panting animated puppy tongue.
3. 🕶️ **Cool Sunglasses**: Glossy dark Wayfarer rims with double bridge, gold rivets, gradient indigo-to-cyan lenses, and specular diagonal shine glints.
4. 👑 **Golden Crown**: Ornate 5-pointed imperial golden crown with metallic gradients, peak spheres, embedded gemstone rubies/emeralds/sapphires, and rotating star glimmers.
5. ✨ **Magic Sparkles**: Real-time particle system with twinkling 4-point diamond stars orbiting cheeks, temples, and forehead with celestial glitter dust.
6. 🌈 **Rainbow Overlay**: Vibrantly glowing 7-color spectral ribbon arching over the nose bridge and cheeks with shimmering wave offsets and glowing cheek clouds.
7. 👽 **Alien Eyes & Green Tint**: Extraterrestrial bioluminescent green skin glow tracing the face oval, giant cosmic pitch-black almond eyes with starry reflections, and a pulsing forehead antenna.
8. 😎 **Retro Pixel Shades**: Iconic 8-bit stepped black sunglasses ("Thug Life" style) with classic stepped white diagonal pixel reflections.
9. 💖 **Floating Hearts**: Pulsing 3D glossy hearts hovering and floating around the head and cheeks with gentle heartbeat rhythm and heart blush stamps.
10. 🤡 **Funny Clown Nose**: Hyper-vibrant 3D glossy red circus nose with spherical specular highlight, rosy rouge cheek circles, and cheerful makeup accents.

### 🎛️ Studio Controls & Photo Capture
- **Filter Intensity Slider**: Smoothly adjust filter opacity and effect scale from 0% to 100%.
- **Photo Snapshot Studio**: Captures composited high-resolution PNG photos combining live camera frames and filter overlays.
- **Download & Copy**: One-click download (`FaceFX_[Filter]_[Timestamp].png`) and direct copy to clipboard.
- **Retake**: Quick return to live preview.
- **Synthesized Web Audio**: Crisp 2-stage camera shutter sound and filter pop sounds synthesized with Web Audio API without external audio files.
- **Keyboard Shortcuts**:
  - `Space`: Capture photo
  - `ArrowLeft` / `ArrowRight`: Navigate between filters
  - `M`: Toggle mirror preview
  - `F`: Flip camera (front / rear)
  - `Escape`: Close modals

### 🔒 100% Client-Side Privacy
- Camera frames never leave your browser.
- No remote backend server, no cookies, no tracking scripts, and no user accounts required.

---

## 🚀 Running the App Locally

Modern web browsers require camera access (`navigator.mediaDevices.getUserMedia`) to be served over **`localhost`** or **`https://`**.

### Option 1: Python HTTP Server (Recommended)
Open your terminal in this project folder and run:

```bash
python -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### Option 2: VS Code Live Server
1. Open this directory in VS Code.
2. Right-click `index.html` and click **"Open with Live Server"**.

### Option 3: Node.js http-server / serve (if installed)
```bash
npx serve .
```

---

## 📁 File Structure

```text
├── index.html       # Semantic HTML5 layout, HUD overlays, snapshot modal, filter tray
├── style.css        # Responsive CSS3 styles, glassmorphism, glowing gradients, animations
├── script.js        # Camera manager, MediaPipe FaceMesh tracking, 10 procedural filters, photo studio
└── README.md        # Documentation, feature guide, and running instructions
```

---

## 💡 Troubleshooting & Tips
- **Camera Permission Denied**: If prompted, make sure to click "Allow" in your browser's address bar. If blocked, click the camera lock icon in the URL bar to reset permissions.
- **No Webcam Available**: Click **"Try Demo Portrait"** on the error dialog to test all filters with the built-in animated virtual face stream!
- **Lighting**: For optimal face landmark tracking, ensure your face is well-lit and facing toward the camera.
