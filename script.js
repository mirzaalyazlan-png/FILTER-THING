/**
 * FaceFX Studio — Real-Time Face Filter Web App
 * Features:
 * - 10 Custom Face Filters tracking facial landmarks in real-time
 * - Mirror Mode, Camera Flip, Intensity Slider, Photo Snapshot Studio
 * - Web Audio API synthesized sound effects
 * - 100% In-browser client-side processing (zero server upload)
 */

(() => {
  'use strict';

  // Canvas roundRect Polyfill for universal browser compatibility
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
      if (!radii) radii = 0;
      if (typeof radii === 'number') radii = [radii, radii, radii, radii];
      const r0 = radii[0] || 0;
      const r1 = radii[1] || r0;
      const r2 = radii[2] || r0;
      const r3 = radii[3] || r1;
      this.moveTo(x + r0, y);
      this.lineTo(x + w - r1, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r1);
      this.lineTo(x + w, y + h - r2);
      this.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
      this.lineTo(x + r3, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r3);
      this.lineTo(x, y + r0);
      this.quadraticCurveTo(x, y, x + r0, y);
      this.closePath();
      return this;
    };
  }

  // =========================================================================
  // Application State
  // =========================================================================
  const state = {
    isCameraRunning: false,
    isModelLoaded: false,
    isProcessingFrame: false,
    currentFilter: 'none',
    filterIntensity: 1.0,
    isMirrored: true,
    facingMode: 'user', // 'user' (front) or 'environment' (back)
    soundEnabled: true,
    lastLandmarks: null,
    videoWidth: 640,
    videoHeight: 480,
    activeStream: null,
    animFrameId: null,
    faceMeshInstance: null,
    isDemoMode: false,
    filterNames: {
      none: { name: 'Original Feed', icon: '🚫' },
      cat: { name: 'Cat Ears & Nose', icon: '🐱' },
      dog: { name: 'Puppy Fun', icon: '🐶' },
      sunglasses: { name: 'Cool Sunglasses', icon: '🕶️' },
      crown: { name: 'Golden Crown', icon: '👑' },
      sparkles: { name: 'Magic Sparkles', icon: '✨' },
      rainbow: { name: 'Rainbow Overlay', icon: '🌈' },
      alien: { name: 'Alien Eyes & Tint', icon: '👽' },
      pixel: { name: 'Retro Pixel Shades', icon: '😎' },
      hearts: { name: 'Floating Hearts', icon: '💖' },
      clown: { name: 'Circus Clown', icon: '🤡' }
    }
  };

  // Sparkle particle system state
  const sparkleParticles = [];
  const TOTAL_SPARKLES = 28;
  for (let i = 0; i < TOTAL_SPARKLES; i++) {
    sparkleParticles.push({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -0.5 - Math.random() * 1.5,
      size: 4 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 2,
      color: ['#fef08a', '#22d3ee', '#f472b6', '#ffffff'][Math.floor(Math.random() * 4)],
      anchorIdx: [10, 116, 346, 168, 152, 234, 454][Math.floor(Math.random() * 7)]
    });
  }

  // Floating hearts particle state
  const floatingHearts = [];
  const TOTAL_HEARTS = 12;
  for (let i = 0; i < TOTAL_HEARTS; i++) {
    floatingHearts.push({
      xOffset: (Math.random() - 0.5) * 180,
      yOffset: Math.random() * -120,
      size: 14 + Math.random() * 16,
      speed: 0.6 + Math.random() * 0.8,
      wobbleSpeed: 2 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.5 + Math.random() * 0.5
    });
  }

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const dom = {
    video: document.getElementById('webcam-video'),
    canvas: document.getElementById('filter-canvas'),
    ctx: null,
    cameraViewport: document.getElementById('camera-viewport'),
    cameraFlash: document.getElementById('camera-flash'),
    
    // Overlays
    welcomeOverlay: document.getElementById('welcome-overlay'),
    loadingOverlay: document.getElementById('loading-overlay'),
    errorOverlay: document.getElementById('error-overlay'),
    loadingStatusText: document.getElementById('loading-status-text'),
    modelProgressFill: document.getElementById('model-progress-fill'),
    errorMessageText: document.getElementById('error-message-text'),

    // HUD & Badges
    activeFilterBadge: document.getElementById('active-filter-badge'),
    trackingStatusBadge: document.getElementById('tracking-status-badge'),
    gallerySelectedName: document.getElementById('gallery-selected-name'),

    // Buttons & Controls
    startCameraBtn: document.getElementById('start-camera-btn'),
    retryCameraBtn: document.getElementById('retry-camera-btn'),
    demoModeBtn: document.getElementById('demo-mode-btn'),
    mirrorToggleBtn: document.getElementById('mirror-toggle-btn'),
    flipCameraBtn: document.getElementById('flip-camera-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    privacyInfoBtn: document.getElementById('privacy-info-btn'),
    clearFilterBtn: document.getElementById('clear-filter-btn'),
    capturePhotoBtn: document.getElementById('capture-photo-btn'),

    // Intensity Slider
    intensitySlider: document.getElementById('filter-intensity-slider'),
    intensityValText: document.getElementById('intensity-val-text'),

    // Gallery
    filterCards: document.querySelectorAll('.filter-card'),
    galleryTrack: document.getElementById('filters-gallery-track'),

    // Snapshot Modal
    snapshotModal: document.getElementById('snapshot-modal'),
    snapshotImgPreview: document.getElementById('snapshot-image-preview'),
    snapshotTimestamp: document.getElementById('snapshot-timestamp'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    retakePhotoBtn: document.getElementById('retake-photo-btn'),
    copyPhotoBtn: document.getElementById('copy-photo-btn'),
    downloadPhotoBtn: document.getElementById('download-photo-btn'),

    // Privacy Modal
    privacyModal: document.getElementById('privacy-modal'),
    closePrivacyBtn: document.getElementById('close-privacy-btn'),
    understandPrivacyBtn: document.getElementById('understand-privacy-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  dom.ctx = dom.canvas.getContext('2d');

  // =========================================================================
  // Web Audio Synthesizer (Zero external audio file dependencies)
  // =========================================================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Camera Shutter Click Sound
  function playShutterSound() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // 1. Initial click
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(800, t);
      osc1.frequency.exponentialRampToValueAtTime(100, t + 0.04);
      gain1.gain.setValueAtTime(0.5, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.05);

      // 2. Mechanical release click
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(500, t + 0.07);
      osc2.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain2.gain.setValueAtTime(0.4, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.13);

      // 3. Crisp white noise burst
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, t + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(t + 0.01);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Filter Pop/Switch Sound
  function playPopSound(freq = 520) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.06);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch (e) {
      console.warn('Pop sound error:', e);
    }
  }

  // Toast Notification
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // =========================================================================
  // MediaPipe FaceMesh Initialization
  // =========================================================================
  async function initFaceMesh() {
    if (state.isModelLoaded && state.faceMeshInstance) {
      return state.faceMeshInstance;
    }

    dom.loadingOverlay.classList.remove('hidden');
    dom.modelProgressFill.style.width = '20%';
    dom.loadingStatusText.textContent = 'Connecting to neural model...';

    if (typeof FaceMesh === 'undefined') {
      throw new Error('MediaPipe FaceMesh library not loaded. Check internet connection or CDN availability.');
    }

    dom.modelProgressFill.style.width = '50%';
    dom.loadingStatusText.textContent = 'Compiling WebAssembly binaries...';

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceResults);

    dom.modelProgressFill.style.width = '85%';
    dom.loadingStatusText.textContent = 'Warming up facial landmarks engine...';

    // Send a warm-up dummy frame once video is loaded
    state.faceMeshInstance = faceMesh;
    state.isModelLoaded = true;

    dom.modelProgressFill.style.width = '100%';
    setTimeout(() => {
      dom.loadingOverlay.classList.add('hidden');
    }, 400);

    return faceMesh;
  }

  // Landmark Results Handler
  function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      state.lastLandmarks = results.multiFaceLandmarks[0];
      updateTrackingHUD(true);
    } else {
      state.lastLandmarks = null;
      updateTrackingHUD(false);
    }
  }

  function updateTrackingHUD(isDetected) {
    const dot = dom.trackingStatusBadge.querySelector('.status-indicator-dot');
    const text = dom.trackingStatusBadge.querySelector('.status-indicator-text');
    if (!state.isCameraRunning && !state.isDemoMode) {
      dot.className = 'status-indicator-dot idle';
      text.textContent = 'Camera Standby';
      return;
    }

    if (isDetected) {
      dot.className = 'status-indicator-dot tracking';
      text.textContent = 'Face Tracking Active';
    } else {
      dot.className = 'status-indicator-dot searching';
      text.textContent = 'Looking for face...';
    }
  }

  // =========================================================================
  // Camera Management
  // =========================================================================
  async function startCamera() {
    try {
      dom.errorOverlay.classList.add('hidden');
      dom.welcomeOverlay.classList.add('hidden');
      dom.loadingOverlay.classList.remove('hidden');
      dom.loadingStatusText.textContent = 'Requesting camera permission...';

      // Ensure audio context is ready on user gesture
      getAudioContext();

      // Check mediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support webcam video capture (mediaDevices.getUserMedia).');
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: state.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.activeStream = stream;
      dom.video.srcObject = stream;

      await new Promise((resolve) => {
        dom.video.onloadedmetadata = () => {
          dom.video.play();
          resolve();
        };
      });

      // Update dimensions
      state.videoWidth = dom.video.videoWidth || 640;
      state.videoHeight = dom.video.videoHeight || 480;
      dom.canvas.width = state.videoWidth;
      dom.canvas.height = state.videoHeight;

      // Adjust camera viewport aspect ratio to match stream natively
      dom.cameraViewport.style.aspectRatio = `${state.videoWidth} / ${state.videoHeight}`;

      // Initialize FaceMesh model
      await initFaceMesh();

      state.isCameraRunning = true;
      dom.capturePhotoBtn.removeAttribute('disabled');
      applyMirrorState();

      // Start the tracking and rendering loop
      startRenderLoop();
      showToast('Camera active! Select a filter below.');
    } catch (err) {
      console.error('Camera startup error:', err);
      dom.loadingOverlay.classList.add('hidden');
      dom.welcomeOverlay.classList.add('hidden');
      dom.errorOverlay.classList.remove('hidden');
      
      let msg = 'Camera access was denied or no camera device was found.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please click the camera icon in your browser address bar to allow camera access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system. You can test filters using Demo Portrait mode!';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application. Please close other video apps and retry.';
      }
      dom.errorMessageText.textContent = msg;
    }
  }

  function stopCamera() {
    if (state.activeStream) {
      state.activeStream.getTracks().forEach((track) => track.stop());
      state.activeStream = null;
    }
    state.isCameraRunning = false;
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    dom.ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    dom.capturePhotoBtn.setAttribute('disabled', 'true');
    updateTrackingHUD(false);
  }

  // Flip Camera between Front ('user') and Back ('environment')
  async function flipCamera() {
    playPopSound(440);
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    // Front camera is mirrored by default; rear camera is not
    state.isMirrored = (state.facingMode === 'user');
    
    showToast(`Switching to ${state.facingMode === 'user' ? 'Front' : 'Rear'} Camera`);

    if (state.isCameraRunning) {
      stopCamera();
      await startCamera();
    }
  }

  // Toggle Mirror preview
  function toggleMirror() {
    playPopSound(600);
    state.isMirrored = !state.isMirrored;
    applyMirrorState();
    showToast(state.isMirrored ? 'Mirror: ON' : 'Mirror: OFF');
  }

  function applyMirrorState() {
    if (state.isMirrored) {
      dom.video.classList.add('mirrored');
      dom.canvas.classList.add('mirrored');
      dom.mirrorToggleBtn.classList.add('active');
    } else {
      dom.video.classList.remove('mirrored');
      dom.canvas.classList.remove('mirrored');
      dom.mirrorToggleBtn.classList.remove('active');
    }
  }

  // =========================================================================
  // Demo Mode Fallback (When no webcam exists or permission denied)
  // =========================================================================
  function startDemoMode() {
    dom.errorOverlay.classList.add('hidden');
    dom.welcomeOverlay.classList.add('hidden');
    dom.loadingOverlay.classList.remove('hidden');
    dom.loadingStatusText.textContent = 'Creating virtual demo portrait...';
    state.isDemoMode = true;

    // Create a virtual animated portrait canvas
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = 640;
    demoCanvas.height = 480;
    const dctx = demoCanvas.getContext('2d');

    state.videoWidth = 640;
    state.videoHeight = 480;
    dom.canvas.width = 640;
    dom.canvas.height = 480;
    dom.cameraViewport.style.aspectRatio = '4 / 3';

    initFaceMesh().then(() => {
      dom.capturePhotoBtn.removeAttribute('disabled');
      let demoTime = 0;

      function renderDemoStream() {
        if (!state.isDemoMode) return;
        demoTime += 0.025;

        // Render synthetic portrait background & animated face
        dctx.fillStyle = '#1e1b4b';
        dctx.fillRect(0, 0, 640, 480);

        // Portrait studio lighting gradient
        const bgGrad = dctx.createRadialGradient(320, 240, 50, 320, 240, 300);
        bgGrad.addColorStop(0, '#312e81');
        bgGrad.addColorStop(1, '#090812');
        dctx.fillStyle = bgGrad;
        dctx.fillRect(0, 0, 640, 480);

        // Subtle head motion simulation
        const headX = 320 + Math.sin(demoTime * 1.2) * 20;
        const headY = 240 + Math.cos(demoTime * 0.9) * 12;
        const headTilt = Math.sin(demoTime * 1.5) * 0.08;

        dctx.save();
        dctx.translate(headX, headY);
        dctx.rotate(headTilt);

        // Shoulders
        dctx.fillStyle = '#4338ca';
        dctx.beginPath();
        dctx.ellipse(0, 190, 160, 90, 0, 0, Math.PI * 2);
        dctx.fill();

        // Neck
        dctx.fillStyle = '#fbcfe8';
        dctx.fillRect(-35, 70, 70, 80);

        // Face Oval
        dctx.fillStyle = '#fde2e4';
        dctx.beginPath();
        dctx.ellipse(0, 0, 95, 125, 0, 0, Math.PI * 2);
        dctx.fill();

        // Hair
        dctx.fillStyle = '#3730a3';
        dctx.beginPath();
        dctx.ellipse(0, -75, 105, 70, 0, 0, Math.PI * 2);
        dctx.fill();

        // Eyes
        dctx.fillStyle = '#1e1b4b';
        dctx.beginPath();
        dctx.ellipse(-38, -15, 12, 14, 0, 0, Math.PI * 2);
        dctx.ellipse(38, -15, 12, 14, 0, 0, Math.PI * 2);
        dctx.fill();

        // Pupils highlights
        dctx.fillStyle = '#ffffff';
        dctx.beginPath();
        dctx.arc(-35, -18, 4, 0, Math.PI * 2);
        dctx.arc(41, -18, 4, 0, Math.PI * 2);
        dctx.fill();

        // Nose
        dctx.strokeStyle = '#e2809d';
        dctx.lineWidth = 3;
        dctx.beginPath();
        dctx.moveTo(0, -5);
        dctx.lineTo(-5, 25);
        dctx.lineTo(5, 25);
        dctx.stroke();

        // Smile
        dctx.beginPath();
        dctx.arc(0, 48, 24, 0.2, Math.PI - 0.2, false);
        dctx.strokeStyle = '#e11d48';
        dctx.lineWidth = 4;
        dctx.stroke();

        dctx.restore();

        // Forward this synthetic frame to FaceMesh
        if (state.faceMeshInstance && !state.isProcessingFrame) {
          state.isProcessingFrame = true;
          state.faceMeshInstance.send({ image: demoCanvas }).finally(() => {
            state.isProcessingFrame = false;
          });
        }

        // Draw synthetic video onto main canvas background
        dom.ctx.clearRect(0, 0, 640, 480);
        dom.ctx.drawImage(demoCanvas, 0, 0);

        // Draw active filter
        if (state.lastLandmarks && state.currentFilter !== 'none') {
          renderFilter(
            dom.ctx,
            640,
            480,
            state.lastLandmarks,
            state.currentFilter,
            state.filterIntensity,
            performance.now() / 1000
          );
        }

        state.animFrameId = requestAnimationFrame(renderDemoStream);
      }

      state.isCameraRunning = true;
      state.isMirrored = false;
      applyMirrorState();
      renderDemoStream();
      showToast('Demo Portrait Mode active! Enjoy the 10 filters.');
    });
  }

  // =========================================================================
  // Main Realtime Render Loop
  // =========================================================================
  function startRenderLoop() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
    }

    async function loop() {
      if (!state.isCameraRunning) return;

      // Send frame to FaceMesh if ready
      if (dom.video.readyState >= 2 && state.faceMeshInstance && !state.isProcessingFrame) {
        state.isProcessingFrame = true;
        state.faceMeshInstance
          .send({ image: dom.video })
          .catch((err) => console.warn('FaceMesh frame send warning:', err))
          .finally(() => {
            state.isProcessingFrame = false;
          });
      }

      // Render Filter Overlay on transparent canvas
      dom.ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);

      if (state.lastLandmarks && state.currentFilter !== 'none') {
        const time = performance.now() / 1000;
        renderFilter(
          dom.ctx,
          dom.canvas.width,
          dom.canvas.height,
          state.lastLandmarks,
          state.currentFilter,
          state.filterIntensity,
          time
        );
      }

      state.animFrameId = requestAnimationFrame(loop);
    }

    state.animFrameId = requestAnimationFrame(loop);
  }

  // =========================================================================
  // 10 Face Filter Renderers
  // =========================================================================
  function renderFilter(ctx, width, height, landmarks, filterType, intensity, time) {
    if (!landmarks || landmarks.length < 468) return;

    // Helper: Normalized to pixel coordinates
    const pt = (idx) => ({
      x: landmarks[idx].x * width,
      y: landmarks[idx].y * height,
      z: landmarks[idx].z || 0
    });

    // Distance & angle helpers
    const dist = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

    // Key Facial Landmarks:
    // Left eye outer: 33, inner: 133, top: 159, bottom: 145
    // Right eye outer: 263, inner: 362, top: 386, bottom: 374
    const leftEye = {
      x: (pt(33).x + pt(133).x) / 2,
      y: (pt(159).y + pt(145).y) / 2
    };
    const rightEye = {
      x: (pt(263).x + pt(362).x) / 2,
      y: (pt(386).y + pt(374).y) / 2
    };

    const midEyes = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };

    const eyeDist = Math.max(10, dist(leftEye, rightEye));
    const headAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    const noseTip = pt(4);
    const foreheadTop = pt(10);
    const chin = pt(152);
    const leftCheek = pt(116);
    const rightCheek = pt(346);
    const mouthLeft = pt(61);
    const mouthRight = pt(291);
    const lowerLip = pt(17);

    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

    switch (filterType) {
      // ---------------------------------------------------------------------
      // 1. 🐱 Cat Ears and a Cute Cat Nose
      // ---------------------------------------------------------------------
      case 'cat': {
        const earDistance = eyeDist * 0.76;
        const earHeight = eyeDist * 0.85;

        // Draw Left & Right Cat Ears
        [-1, 1].forEach((dir) => {
          ctx.save();
          // Position relative to forehead with angle
          const earRootX = foreheadTop.x + Math.cos(headAngle) * (dir * earDistance) - Math.sin(headAngle) * (earHeight * 0.2);
          const earRootY = foreheadTop.y + Math.sin(headAngle) * (dir * earDistance) + Math.cos(headAngle) * (earHeight * 0.2);

          ctx.translate(earRootX, earRootY);
          ctx.rotate(headAngle + (dir * 0.18));

          // Outer fluffy ear
          ctx.fillStyle = '#261b42';
          ctx.beginPath();
          ctx.moveTo(-earDistance * 0.45, 0);
          ctx.quadraticCurveTo(-earDistance * 0.35, -earHeight, 0, -earHeight * 1.15);
          ctx.quadraticCurveTo(earDistance * 0.35, -earHeight, earDistance * 0.45, 0);
          ctx.closePath();
          ctx.fill();

          // Outer ear outline
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Fluffy tufts on side
          ctx.fillStyle = '#382b5e';
          ctx.beginPath();
          ctx.moveTo(dir * earDistance * 0.35, -earHeight * 0.3);
          ctx.lineTo(dir * earDistance * 0.55, -earHeight * 0.45);
          ctx.lineTo(dir * earDistance * 0.3, -earHeight * 0.6);
          ctx.closePath();
          ctx.fill();

          // Inner Pink Ear
          const innerGrad = ctx.createLinearGradient(0, 0, 0, -earHeight);
          innerGrad.addColorStop(0, '#f472b6');
          innerGrad.addColorStop(1, '#fda4af');
          ctx.fillStyle = innerGrad;
          ctx.beginPath();
          ctx.moveTo(-earDistance * 0.26, -earHeight * 0.1);
          ctx.quadraticCurveTo(-earDistance * 0.18, -earHeight * 0.85, 0, -earHeight * 0.95);
          ctx.quadraticCurveTo(earDistance * 0.18, -earHeight * 0.85, earDistance * 0.26, -earHeight * 0.1);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        });

        // Cute Pink Cat Nose (at nose tip pt 4)
        ctx.save();
        ctx.translate(noseTip.x, noseTip.y);
        ctx.rotate(headAngle);
        const noseW = eyeDist * 0.26;
        const noseH = eyeDist * 0.18;

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(-noseW, -noseH * 0.4);
        ctx.quadraticCurveTo(0, -noseH * 0.6, noseW, -noseH * 0.4);
        ctx.quadraticCurveTo(noseW * 0.7, noseH * 0.6, 0, noseH * 0.7);
        ctx.quadraticCurveTo(-noseW * 0.7, noseH * 0.6, -noseW, -noseH * 0.4);
        ctx.closePath();
        ctx.fill();

        // Nose specular shine highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(-noseW * 0.35, -noseH * 0.2, noseW * 0.22, noseH * 0.15, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Whiskers (Left & Right)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Left Whiskers
        [-18, 0, 18].forEach((offsetDeg) => {
          ctx.beginPath();
          ctx.moveTo(mouthLeft.x - eyeDist * 0.1, mouthLeft.y - eyeDist * 0.05);
          const rad = headAngle + Math.PI + (offsetDeg * Math.PI) / 180;
          const cpX = mouthLeft.x + Math.cos(rad) * (eyeDist * 0.5);
          const cpY = mouthLeft.y + Math.sin(rad) * (eyeDist * 0.5) - 8;
          const endX = mouthLeft.x + Math.cos(rad) * (eyeDist * 0.95);
          const endY = mouthLeft.y + Math.sin(rad) * (eyeDist * 0.95);
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
          ctx.stroke();
        });

        // Right Whiskers
        [-18, 0, 18].forEach((offsetDeg) => {
          ctx.beginPath();
          ctx.moveTo(mouthRight.x + eyeDist * 0.1, mouthRight.y - eyeDist * 0.05);
          const rad = headAngle + (offsetDeg * Math.PI) / 180;
          const cpX = mouthRight.x + Math.cos(rad) * (eyeDist * 0.5);
          const cpY = mouthRight.y + Math.sin(rad) * (eyeDist * 0.5) - 8;
          const endX = mouthRight.x + Math.cos(rad) * (eyeDist * 0.95);
          const endY = mouthRight.y + Math.sin(rad) * (eyeDist * 0.95);
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
          ctx.stroke();
        });

        // Soft pink cheek blushes
        [leftCheek, rightCheek].forEach((cheek) => {
          const blushGrad = ctx.createRadialGradient(cheek.x, cheek.y, 4, cheek.x, cheek.y, eyeDist * 0.32);
          blushGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
          blushGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
          ctx.fillStyle = blushGrad;
          ctx.beginPath();
          ctx.arc(cheek.x, cheek.y, eyeDist * 0.32, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      // ---------------------------------------------------------------------
      // 2. 🐶 Puppy Ears and a Dog Nose
      // ---------------------------------------------------------------------
      case 'dog': {
        const earSpan = eyeDist * 0.95;
        const earLen = eyeDist * 1.15;
        const bounce = Math.sin(time * 3) * 6;

        // Floppy puppy ears on temples
        [-1, 1].forEach((dir) => {
          ctx.save();
          const baseAnchorX = foreheadTop.x + Math.cos(headAngle) * (dir * earSpan);
          const baseAnchorY = foreheadTop.y + Math.sin(headAngle) * (dir * earSpan);

          ctx.translate(baseAnchorX, baseAnchorY);
          ctx.rotate(headAngle + (dir * 0.3) + (bounce * 0.01 * dir));

          // Outer floppy ear (Warm caramel brown)
          const earGrad = ctx.createLinearGradient(0, 0, 0, earLen);
          earGrad.addColorStop(0, '#b45309');
          earGrad.addColorStop(0.7, '#78350f');
          earGrad.addColorStop(1, '#451a03');

          ctx.fillStyle = earGrad;
          ctx.beginPath();
          ctx.moveTo(-earSpan * 0.25, 0);
          ctx.bezierCurveTo(
            -earSpan * 0.45, earLen * 0.4,
            dir * earSpan * 0.6, earLen * 0.8,
            0, earLen
          );
          ctx.bezierCurveTo(
            earSpan * 0.35, earLen * 0.7,
            earSpan * 0.25, earLen * 0.3,
            earSpan * 0.25, 0
          );
          ctx.closePath();
          ctx.fill();

          // Darker velvety inner fold
          ctx.fillStyle = 'rgba(69, 26, 3, 0.45)';
          ctx.beginPath();
          ctx.ellipse(0, earLen * 0.5, earSpan * 0.15, earLen * 0.3, dir * 0.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });

        // Dog Button Nose (at nose tip pt 4)
        ctx.save();
        ctx.translate(noseTip.x, noseTip.y + 4);
        ctx.rotate(headAngle);
        const dogNoseW = eyeDist * 0.42;
        const dogNoseH = eyeDist * 0.3;

        // Main nose body (deep textured black/brown)
        const noseGrad = ctx.createRadialGradient(0, -dogNoseH * 0.2, 2, 0, 0, dogNoseW);
        noseGrad.addColorStop(0, '#27272a');
        noseGrad.addColorStop(1, '#09090b');
        ctx.fillStyle = noseGrad;

        ctx.beginPath();
        ctx.moveTo(-dogNoseW * 0.5, -dogNoseH * 0.4);
        ctx.quadraticCurveTo(0, -dogNoseH * 0.6, dogNoseW * 0.5, -dogNoseH * 0.4);
        ctx.quadraticCurveTo(dogNoseW * 0.55, dogNoseH * 0.5, 0, dogNoseH * 0.5);
        ctx.quadraticCurveTo(-dogNoseW * 0.55, dogNoseH * 0.5, -dogNoseW * 0.5, -dogNoseH * 0.4);
        ctx.closePath();
        ctx.fill();

        // Nostril indentations
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(-dogNoseW * 0.25, dogNoseH * 0.1, dogNoseW * 0.12, dogNoseH * 0.14, -0.2, 0, Math.PI * 2);
        ctx.ellipse(dogNoseW * 0.25, dogNoseH * 0.1, dogNoseW * 0.12, dogNoseH * 0.14, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Central vertical crease (philtrum)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, dogNoseH * 0.1);
        ctx.lineTo(0, dogNoseH * 0.55);
        ctx.stroke();

        // Specular glossy reflection on nose top
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.ellipse(-dogNoseW * 0.16, -dogNoseH * 0.25, dogNoseW * 0.16, dogNoseH * 0.1, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Adorable Dog Tongue (Panting below lower lip pt 17)
        ctx.save();
        ctx.translate(lowerLip.x, lowerLip.y + 4);
        ctx.rotate(headAngle);
        const tongueW = eyeDist * 0.28;
        const tongueH = eyeDist * 0.45;
        const tongueBob = Math.sin(time * 6) * 3;

        // Tongue shape
        const tongueGrad = ctx.createLinearGradient(0, 0, 0, tongueH);
        tongueGrad.addColorStop(0, '#f43f5e');
        tongueGrad.addColorStop(1, '#fda4af');
        ctx.fillStyle = tongueGrad;

        ctx.beginPath();
        ctx.moveTo(-tongueW * 0.5, 0);
        ctx.quadraticCurveTo(-tongueW * 0.55, tongueH + tongueBob, 0, tongueH + tongueBob + 6);
        ctx.quadraticCurveTo(tongueW * 0.55, tongueH + tongueBob, tongueW * 0.5, 0);
        ctx.closePath();
        ctx.fill();

        // Tongue center line
        ctx.strokeStyle = 'rgba(190, 18, 60, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(0, tongueH + tongueBob);
        ctx.stroke();

        ctx.restore();

        // Puppy freckles on muzzle
        ctx.fillStyle = '#78350f';
        [
          { x: noseTip.x - eyeDist * 0.22, y: noseTip.y + eyeDist * 0.16 },
          { x: noseTip.x - eyeDist * 0.32, y: noseTip.y + eyeDist * 0.18 },
          { x: noseTip.x - eyeDist * 0.24, y: noseTip.y + eyeDist * 0.26 },
          { x: noseTip.x + eyeDist * 0.22, y: noseTip.y + eyeDist * 0.16 },
          { x: noseTip.x + eyeDist * 0.32, y: noseTip.y + eyeDist * 0.18 },
          { x: noseTip.x + eyeDist * 0.24, y: noseTip.y + eyeDist * 0.26 }
        ].forEach((dot) => {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      // ---------------------------------------------------------------------
      // 3. 🕶️ Cool Sunglasses
      // ---------------------------------------------------------------------
      case 'sunglasses': {
        ctx.save();
        ctx.translate(midEyes.x, midEyes.y + 4);
        ctx.rotate(headAngle);

        const glassesW = eyeDist * 2.35;
        const lensW = eyeDist * 0.85;
        const lensH = eyeDist * 0.68;
        const bridgeW = eyeDist * 0.3;

        // Drop shadow for 3D realism
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;

        // Frame: Modern dark Wayfarer rims
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;

        // Left Lens Rim
        ctx.beginPath();
        ctx.roundRect(-bridgeW * 0.5 - lensW, -lensH * 0.45, lensW, lensH, [16, 8, 28, 22]);
        ctx.fill();
        ctx.stroke();

        // Right Lens Rim
        ctx.beginPath();
        ctx.roundRect(bridgeW * 0.5, -lensH * 0.45, lensW, lensH, [8, 16, 22, 28]);
        ctx.fill();
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Bridge connecting lenses
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-bridgeW * 0.55, -lensH * 0.35, bridgeW * 1.1, 8, 4);
        ctx.fill();

        // Metallic Gold Brow Bar
        const barGrad = ctx.createLinearGradient(-glassesW * 0.4, 0, glassesW * 0.4, 0);
        barGrad.addColorStop(0, '#f59e0b');
        barGrad.addColorStop(0.5, '#fef08a');
        barGrad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = barGrad;
        ctx.fillRect(-glassesW * 0.48, -lensH * 0.48, glassesW * 0.96, 4);

        // Gradient Tinted Lenses (Deep twilight indigo to cyan sheen)
        [-1, 1].forEach((dir) => {
          const lX = dir === -1 ? -bridgeW * 0.5 - lensW + 5 : bridgeW * 0.5 + 5;
          const lY = -lensH * 0.45 + 5;
          const lW = lensW - 10;
          const lH = lensH - 10;

          const lensGrad = ctx.createLinearGradient(lX, lY, lX, lY + lH);
          lensGrad.addColorStop(0, 'rgba(15, 23, 42, 0.94)');
          lensGrad.addColorStop(0.65, 'rgba(30, 27, 75, 0.92)');
          lensGrad.addColorStop(1, 'rgba(6, 182, 212, 0.85)');
          ctx.fillStyle = lensGrad;

          ctx.beginPath();
          ctx.roundRect(lX, lY, lW, lH, [12, 12, 22, 22]);
          ctx.fill();

          // Diagonal White Specular Reflection Bars
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(lX, lY, lW, lH, [12, 12, 22, 22]);
          ctx.clip();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.moveTo(lX + lW * 0.3, lY);
          ctx.lineTo(lX + lW * 0.5, lY);
          ctx.lineTo(lX + lW * 0.2, lY + lH);
          ctx.lineTo(lX, lY + lH);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.moveTo(lX + lW * 0.6, lY);
          ctx.lineTo(lX + lW * 0.72, lY);
          ctx.lineTo(lX + lW * 0.42, lY + lH);
          ctx.lineTo(lX + lW * 0.3, lY + lH);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        });

        // Gold Temple Accent Studs
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-bridgeW * 0.5 - lensW + 8, -lensH * 0.35, 3.5, 0, Math.PI * 2);
        ctx.arc(bridgeW * 0.5 + lensW - 8, -lensH * 0.35, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 4. 👑 A Golden Crown
      // ---------------------------------------------------------------------
      case 'crown': {
        ctx.save();
        // Position directly above forehead top pt 10
        const crownBaseY = foreheadTop.y - Math.cos(headAngle) * (eyeDist * 0.15);
        const crownBaseX = foreheadTop.x + Math.sin(headAngle) * (eyeDist * 0.15);

        ctx.translate(crownBaseX, crownBaseY);
        ctx.rotate(headAngle);

        const crownW = eyeDist * 1.85;
        const crownH = eyeDist * 1.1;

        // Crown Drop Shadow
        ctx.shadowColor = 'rgba(234, 179, 8, 0.5)';
        ctx.shadowBlur = 24;

        // Rich metallic gold gradient
        const crownGrad = ctx.createLinearGradient(-crownW * 0.5, 0, crownW * 0.5, 0);
        crownGrad.addColorStop(0, '#b45309');
        crownGrad.addColorStop(0.25, '#fef08a');
        crownGrad.addColorStop(0.5, '#eab308');
        crownGrad.addColorStop(0.75, '#fef08a');
        crownGrad.addColorStop(1, '#b45309');

        // Draw 5-pointed Royal Crown
        ctx.fillStyle = crownGrad;
        ctx.beginPath();
        ctx.moveTo(-crownW * 0.5, 0);
        // Left peak
        ctx.lineTo(-crownW * 0.48, -crownH * 0.65);
        ctx.lineTo(-crownW * 0.3, -crownH * 0.35);
        // Mid-left peak
        ctx.lineTo(-crownW * 0.22, -crownH * 0.85);
        ctx.lineTo(-crownW * 0.08, -crownH * 0.4);
        // Grand Center peak
        ctx.lineTo(0, -crownH * 1.15);
        // Mid-right peak
        ctx.lineTo(crownW * 0.08, -crownH * 0.4);
        ctx.lineTo(crownW * 0.22, -crownH * 0.85);
        ctx.lineTo(crownW * 0.3, -crownH * 0.35);
        // Right peak
        ctx.lineTo(crownW * 0.48, -crownH * 0.65);
        ctx.lineTo(crownW * 0.5, 0);
        // Base band
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Golden spheres atop each of the 5 peaks
        const peakPoints = [
          { x: -crownW * 0.48, y: -crownH * 0.65, r: 6 },
          { x: -crownW * 0.22, y: -crownH * 0.85, r: 7.5 },
          { x: 0, y: -crownH * 1.15, r: 9 },
          { x: crownW * 0.22, y: -crownH * 0.85, r: 7.5 },
          { x: crownW * 0.48, y: -crownH * 0.65, r: 6 }
        ];

        peakPoints.forEach((pk, i) => {
          const ballGrad = ctx.createRadialGradient(pk.x - 2, pk.y - 2, 1, pk.x, pk.y, pk.r);
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.5, '#fef08a');
          ballGrad.addColorStop(1, '#ca8a04');
          ctx.fillStyle = ballGrad;
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
          ctx.fill();

          // Animated twinkling sparkle glint on center and outer tips
          if (i % 2 === 0) {
            const sparkleRot = time * 2.5 + i;
            const sparkleScale = 0.8 + Math.sin(time * 5 + i) * 0.3;
            ctx.save();
            ctx.translate(pk.x, pk.y);
            ctx.rotate(sparkleRot);
            ctx.scale(sparkleScale, sparkleScale);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(2, -2);
            ctx.lineTo(12, 0);
            ctx.lineTo(2, 2);
            ctx.lineTo(0, 12);
            ctx.lineTo(-2, 2);
            ctx.lineTo(-12, 0);
            ctx.lineTo(-2, -2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        });

        // Ornate Jewel Band along bottom of crown
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(-crownW * 0.48, -8, crownW * 0.96, 12);

        // Embedded Gems: Ruby, Emerald, Sapphire, Amethyst
        const gemColors = ['#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#10b981'];
        const numGems = 6;
        for (let g = 0; g < numGems; g++) {
          const gemX = -crownW * 0.4 + (g * (crownW * 0.8)) / (numGems - 1);
          ctx.fillStyle = gemColors[g];
          ctx.beginPath();
          ctx.arc(gemX, -2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gemX - 1.5, -3.5, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 5. ✨ Sparkles around the face
      // ---------------------------------------------------------------------
      case 'sparkles': {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Update and render orbiting sparkle particles
        sparkleParticles.forEach((sp, idx) => {
          const anchor = pt(sp.anchorIdx);
          const orbitR = eyeDist * (0.4 + (idx % 4) * 0.2);
          const orbitAngle = time * sp.speed + sp.phase;

          const px = anchor.x + Math.cos(orbitAngle) * orbitR;
          const py = anchor.y + Math.sin(orbitAngle) * (orbitR * 0.7);

          const scale = 0.5 + Math.sin(time * 6 + sp.phase) * 0.5;
          if (scale <= 0.05) return;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(time * 3 + sp.phase);
          ctx.scale(scale, scale);

          // Star Halo Glow
          const haloGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, sp.size * 2);
          haloGrad.addColorStop(0, sp.color);
          haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(0, 0, sp.size * 2, 0, Math.PI * 2);
          ctx.fill();

          // 4-Point Star Core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(0, -sp.size * 1.4);
          ctx.lineTo(sp.size * 0.25, -sp.size * 0.25);
          ctx.lineTo(sp.size * 1.4, 0);
          ctx.lineTo(sp.size * 0.25, sp.size * 0.25);
          ctx.lineTo(0, sp.size * 1.4);
          ctx.lineTo(-sp.size * 0.25, sp.size * 0.25);
          ctx.lineTo(-sp.size * 1.4, 0);
          ctx.lineTo(-sp.size * 0.25, -sp.size * 0.25);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        });

        // Celestial glitter dust across nose bridge and cheekbones
        ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
        [
          { x: leftCheek.x + 10, y: leftCheek.y - 10, s: 2.5 },
          { x: leftCheek.x + 25, y: leftCheek.y + 5, s: 3 },
          { x: midEyes.x - 12, y: midEyes.y + 16, s: 2 },
          { x: midEyes.x + 15, y: midEyes.y + 18, s: 2.5 },
          { x: rightCheek.x - 20, y: rightCheek.y - 8, s: 3 },
          { x: rightCheek.x - 10, y: rightCheek.y + 6, s: 2 }
        ].forEach((g) => {
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.s, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 6. 🌈 Rainbow Overlay Effects
      // ---------------------------------------------------------------------
      case 'rainbow': {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const rainbowColors = [
          '#ff0055', // Red
          '#ff7700', // Orange
          '#ffea00', // Yellow
          '#00e676', // Green
          '#00e5ff', // Cyan
          '#2979ff', // Blue
          '#d500f9'  // Violet
        ];

        // Arching Rainbow Ribbon across cheeks & nose
        const startX = leftCheek.x - eyeDist * 0.4;
        const startY = leftCheek.y + eyeDist * 0.1;
        const endX = rightCheek.x + eyeDist * 0.4;
        const endY = rightCheek.y + eyeDist * 0.1;
        const midX = noseTip.x;
        const midY = noseTip.y - eyeDist * 0.35 + Math.sin(time * 3) * 6;

        const ribbonWidth = 6.5;
        rainbowColors.forEach((color, i) => {
          const yOff = (i - 3) * ribbonWidth;
          ctx.strokeStyle = color;
          ctx.lineWidth = ribbonWidth + 1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(startX, startY + yOff);
          ctx.quadraticCurveTo(midX, midY + yOff, endX, endY + yOff);
          ctx.stroke();
        });

        // Cute glowing rainbow blush circles on cheeks
        [leftCheek, rightCheek].forEach((cheek, idx) => {
          const blushGrad = ctx.createRadialGradient(cheek.x, cheek.y, 2, cheek.x, cheek.y, eyeDist * 0.35);
          blushGrad.addColorStop(0, 'rgba(255, 119, 0, 0.4)');
          blushGrad.addColorStop(0.5, 'rgba(213, 0, 249, 0.3)');
          blushGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = blushGrad;
          ctx.beginPath();
          ctx.arc(cheek.x, cheek.y, eyeDist * 0.35, 0, Math.PI * 2);
          ctx.fill();

          // Star accent on cheeks
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cheek.x + (idx === 0 ? -12 : 12), cheek.y - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 7. 👽 Alien Eyes and a Green Tint
      // ---------------------------------------------------------------------
      case 'alien': {
        ctx.save();

        // 1. Extraterrestrial Bioluminescent Green Skin Glow
        // Tracing Face Oval landmarks
        const faceOvalIndices = [
          10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
          379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
          234, 127, 162, 21, 54, 103, 67, 109
        ];

        ctx.beginPath();
        faceOvalIndices.forEach((idx, i) => {
          const p = pt(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();

        // Green skin overlay with subtle opacity
        ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        ctx.fill();

        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 20;
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 2. Giant Almond-Shaped Alien Eyes
        [
          { eye: leftEye, dir: -1 },
          { eye: rightEye, dir: 1 }
        ].forEach(({ eye, dir }) => {
          ctx.save();
          ctx.translate(eye.x, eye.y);
          // Angle tilted upward and outward like classic extraterrestrial eyes
          ctx.rotate(headAngle + (dir * 0.22));

          const alienEyeW = eyeDist * 0.52;
          const alienEyeH = eyeDist * 0.72;

          // Deep Pitch-Black Glossy Eye
          const eyeGrad = ctx.createRadialGradient(
            dir * -alienEyeW * 0.2, -alienEyeH * 0.2, 4,
            0, 0, alienEyeH
          );
          eyeGrad.addColorStop(0, '#18181b');
          eyeGrad.addColorStop(0.6, '#09090b');
          eyeGrad.addColorStop(1, '#000000');

          ctx.fillStyle = eyeGrad;
          ctx.beginPath();
          ctx.moveTo(0, -alienEyeH * 0.5);
          ctx.bezierCurveTo(alienEyeW * 0.65, -alienEyeH * 0.3, alienEyeW * 0.65, alienEyeH * 0.3, 0, alienEyeH * 0.5);
          ctx.bezierCurveTo(-alienEyeW * 0.65, alienEyeH * 0.3, -alienEyeW * 0.65, -alienEyeH * 0.3, 0, -alienEyeH * 0.5);
          ctx.closePath();
          ctx.fill();

          // Green/Cyan iridescent rim
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Cosmic purple & cyan nebula sheen inside eye
          const sheenGrad = ctx.createLinearGradient(0, alienEyeH * 0.1, 0, alienEyeH * 0.45);
          sheenGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
          sheenGrad.addColorStop(1, 'rgba(6, 182, 212, 0.45)');
          ctx.fillStyle = sheenGrad;
          ctx.beginPath();
          ctx.ellipse(0, alienEyeH * 0.22, alienEyeW * 0.35, alienEyeH * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();

          // White specular diamond star reflection
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(dir * -alienEyeW * 0.18, -alienEyeH * 0.2, alienEyeW * 0.14, alienEyeH * 0.08, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dir * alienEyeW * 0.12, -alienEyeH * 0.08, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });

        // 3. Glowing Extraterrestrial Forehead Antenna
        ctx.save();
        ctx.translate(foreheadTop.x, foreheadTop.y);
        ctx.rotate(headAngle);

        const antLen = eyeDist * 0.75;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.sin(time * 4) * 15, -antLen * 0.5, 0, -antLen);
        ctx.stroke();

        // Pulsing glowing orb at antenna tip
        const orbScale = 1 + Math.sin(time * 6) * 0.25;
        const orbGrad = ctx.createRadialGradient(0, -antLen, 2, 0, -antLen, 14 * orbScale);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.4, '#4ade80');
        orbGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(0, -antLen, 14 * orbScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 8. 😎 Retro Pixel Sunglasses ("Thug Life" 8-bit Meme Shades)
      // ---------------------------------------------------------------------
      case 'pixel': {
        ctx.save();
        ctx.translate(midEyes.x, midEyes.y + 2);
        ctx.rotate(headAngle);

        // Integer pixel block grid unit
        const u = Math.max(3, Math.round(eyeDist / 14));
        ctx.fillStyle = '#000000';

        // 8-bit stepped pixel matrix representation
        // Row-by-row pixel coordinates: [xIndex, yIndex, widthInUnits, heightInUnits]
        const pixelBlocks = [
          // Top frame bar across top of glasses
          [-14, -4, 28, 2],

          // Left Lens Stepped Contour (Black)
          [-13, -2, 10, 2],
          [-12, 0, 9, 2],
          [-11, 2, 8, 2],
          [-10, 4, 7, 2],

          // Right Lens Stepped Contour (Black)
          [3, -2, 10, 2],
          [3, 0, 9, 2],
          [3, 2, 8, 2],
          [3, 4, 7, 2],

          // Bridge between eyes
          [-3, -3, 6, 2],

          // Temple arms extending outwards
          [-17, -4, 3, 2],
          [14, -4, 3, 2]
        ];

        pixelBlocks.forEach(([px, py, pw, ph]) => {
          ctx.fillRect(px * u, py * u, pw * u, ph * u);
        });

        // Iconic 8-bit White Diagonal Pixel Glint Steps (Specular shine)
        ctx.fillStyle = '#ffffff';
        const glintPixels = [
          // Left lens white glint steps
          [-11, -2, 1, 1],
          [-10, -1, 1, 1],
          [-9, 0, 1, 1],
          [-8, 1, 1, 1],
          [-7, 2, 1, 1],

          // Secondary left glint
          [-8, -2, 1, 1],
          [-7, -1, 1, 1],

          // Right lens white glint steps
          [5, -2, 1, 1],
          [6, -1, 1, 1],
          [7, 0, 1, 1],
          [8, 1, 1, 1],
          [9, 2, 1, 1],

          // Secondary right glint
          [8, -2, 1, 1],
          [9, -1, 1, 1]
        ];

        glintPixels.forEach(([gx, gy, gw, gh]) => {
          ctx.fillRect(gx * u, gy * u, gw * u, gh * u);
        });

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 9. 💖 Floating Hearts around the face
      // ---------------------------------------------------------------------
      case 'hearts': {
        ctx.save();

        // Helper to draw a crisp 3D heart
        function drawHeart(cx, cy, size, rot = 0, colorStart = '#ff2a6d', colorEnd = '#fda4af') {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);

          const hGrad = ctx.createLinearGradient(0, -size, 0, size);
          hGrad.addColorStop(0, colorEnd);
          hGrad.addColorStop(1, colorStart);
          ctx.fillStyle = hGrad;

          ctx.beginPath();
          ctx.moveTo(0, size * 0.35);
          ctx.bezierCurveTo(-size * 0.6, -size * 0.25, -size * 0.9, -size * 0.8, -size * 0.45, -size * 0.9);
          ctx.bezierCurveTo(-size * 0.1, -size * 0.9, 0, -size * 0.5, 0, -size * 0.4);
          ctx.bezierCurveTo(0, -size * 0.5, size * 0.1, -size * 0.9, size * 0.45, -size * 0.9);
          ctx.bezierCurveTo(size * 0.9, -size * 0.8, size * 0.6, -size * 0.25, 0, size * 0.35);
          ctx.closePath();
          ctx.fill();

          // Specular glossy reflection
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.ellipse(-size * 0.35, -size * 0.65, size * 0.14, size * 0.22, -0.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // Main pulsing giant heart floating above forehead
        const pulse = 1 + Math.sin(time * 5) * 0.15;
        const mainHeartY = foreheadTop.y - eyeDist * 0.75 + Math.sin(time * 3) * 10;
        drawHeart(foreheadTop.x, mainHeartY, eyeDist * 0.45 * pulse, headAngle * 0.3);

        // Orbiting floating hearts rising and swaying
        floatingHearts.forEach((h, idx) => {
          const wobble = Math.sin(time * h.wobbleSpeed + h.phase) * 18;
          const orbitX = midEyes.x + h.xOffset + wobble;
          const orbitY = midEyes.y + h.yOffset - ((time * 30 * h.speed + idx * 25) % 180);
          drawHeart(orbitX, orbitY, h.size, Math.sin(time + idx) * 0.2);
        });

        // Cute glowing heart-shaped blush on both cheeks
        [leftCheek, rightCheek].forEach((cheek, idx) => {
          ctx.save();
          ctx.globalAlpha = 0.7;
          drawHeart(cheek.x, cheek.y, eyeDist * 0.22, (idx === 0 ? -0.15 : 0.15));
          ctx.restore();
        });

        ctx.restore();
        break;
      }

      // ---------------------------------------------------------------------
      // 10. 🤡 Funny Clown Nose
      // ---------------------------------------------------------------------
      case 'clown': {
        ctx.save();

        // 1. Giant 3D Circus Clown Nose (at nose tip pt 4)
        const noseRadius = eyeDist * 0.32;
        const noseX = noseTip.x;
        const noseY = noseTip.y + 2;

        // Shadow behind the nose
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;

        // Realistic 3D Sphere Radial Gradient
        const sphereGrad = ctx.createRadialGradient(
          noseX - noseRadius * 0.35, noseY - noseRadius * 0.35, noseRadius * 0.1,
          noseX, noseY, noseRadius
        );
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.18, '#f87171');
        sphereGrad.addColorStop(0.5, '#ef4444');
        sphereGrad.addColorStop(0.85, '#dc2626');
        sphereGrad.addColorStop(1, '#7f1d1d');

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(noseX, noseY, noseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Clear shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // High gloss white reflection dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(noseX - noseRadius * 0.32, noseY - noseRadius * 0.32, noseRadius * 0.22, noseRadius * 0.14, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // 2. Rosy Clown Cheek Circles
        [leftCheek, rightCheek].forEach((cheek) => {
          const cheekGrad = ctx.createRadialGradient(cheek.x, cheek.y, 2, cheek.x, cheek.y, eyeDist * 0.28);
          cheekGrad.addColorStop(0, 'rgba(239, 68, 68, 0.75)');
          cheekGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.4)');
          cheekGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = cheekGrad;
          ctx.beginPath();
          ctx.arc(cheek.x, cheek.y, eyeDist * 0.28, 0, Math.PI * 2);
          ctx.fill();
        });

        // 3. Colorful Clown Eye Diamonds (Above and Below Eyes)
        ctx.fillStyle = '#06b6d4';
        [leftEye, rightEye].forEach((eye) => {
          // Upper diamond
          ctx.beginPath();
          ctx.moveTo(eye.x, eye.y - eyeDist * 0.45);
          ctx.lineTo(eye.x - 7, eye.y - eyeDist * 0.28);
          ctx.lineTo(eye.x, eye.y - eyeDist * 0.12);
          ctx.lineTo(eye.x + 7, eye.y - eyeDist * 0.28);
          ctx.closePath();
          ctx.fill();

          // Lower diamond teardrop
          ctx.beginPath();
          ctx.moveTo(eye.x, eye.y + eyeDist * 0.12);
          ctx.lineTo(eye.x - 6, eye.y + eyeDist * 0.25);
          ctx.lineTo(eye.x, eye.y + eyeDist * 0.4);
          ctx.lineTo(eye.x + 6, eye.y + eyeDist * 0.25);
          ctx.closePath();
          ctx.fill();
        });

        // 4. Cheerful Clown Smile Lip Contour
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mouthLeft.x - 10, mouthLeft.y - 6);
        ctx.quadraticCurveTo(chin.x, lowerLip.y + eyeDist * 0.2, mouthRight.x + 10, mouthRight.y - 6);
        ctx.stroke();

        ctx.restore();
        break;
      }

      default:
        break;
    }

    ctx.restore();
  }

  // =========================================================================
  // Photo Capture & Snapshot Studio
  // =========================================================================
  function capturePhoto() {
    if (!state.isCameraRunning && !state.isDemoMode) {
      showToast('Please start the camera first!');
      return;
    }

    playShutterSound();

    // Trigger visual camera flash
    dom.cameraFlash.classList.add('flash-active');
    setTimeout(() => {
      dom.cameraFlash.classList.remove('flash-active');
    }, 450);

    // Create high-resolution composite offscreen canvas
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = state.videoWidth;
    captureCanvas.height = state.videoHeight;
    const cctx = captureCanvas.getContext('2d');

    const w = captureCanvas.width;
    const h = captureCanvas.height;

    // Draw video frame (mirrored if preview is mirrored)
    if (state.isMirrored) {
      cctx.save();
      cctx.translate(w, 0);
      cctx.scale(-1, 1);
      if (state.isDemoMode) {
        cctx.drawImage(dom.canvas, 0, 0, w, h);
      } else {
        cctx.drawImage(dom.video, 0, 0, w, h);
      }
      cctx.restore();
    } else {
      if (state.isDemoMode) {
        cctx.drawImage(dom.canvas, 0, 0, w, h);
      } else {
        cctx.drawImage(dom.video, 0, 0, w, h);
      }
    }

    // Draw active filter overlay onto snapshot
    if (state.lastLandmarks && state.currentFilter !== 'none') {
      if (state.isMirrored) {
        cctx.save();
        cctx.translate(w, 0);
        cctx.scale(-1, 1);
        renderFilter(cctx, w, h, state.lastLandmarks, state.currentFilter, state.filterIntensity, performance.now() / 1000);
        cctx.restore();
      } else {
        renderFilter(cctx, w, h, state.lastLandmarks, state.currentFilter, state.filterIntensity, performance.now() / 1000);
      }
    }

    // Convert to PNG data URL
    const photoDataUrl = captureCanvas.toDataURL('image/png');
    dom.snapshotImgPreview.src = photoDataUrl;

    const now = new Date();
    dom.snapshotTimestamp.textContent = `Captured on ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    // Set download link action
    dom.downloadPhotoBtn.onclick = () => {
      playPopSound(700);
      const link = document.createElement('a');
      const timeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `FaceFX_${state.currentFilter}_${timeStr}.png`;
      link.href = photoDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Photo downloaded successfully! 🎉');
    };

    // Set copy to clipboard action
    dom.copyPhotoBtn.onclick = async () => {
      try {
        const blob = await new Promise((res) => captureCanvas.toBlob(res, 'image/png'));
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          showToast('Photo copied to clipboard! 📋');
        } else {
          showToast('Clipboard image copying not supported on this browser.');
        }
      } catch (e) {
        console.warn('Clipboard write error:', e);
        showToast('Unable to copy directly. Use Download PNG!');
      }
    };

    // Open snapshot preview modal
    dom.snapshotModal.classList.remove('hidden');
  }

  // =========================================================================
  // UI Event Listeners & Filter Selection
  // =========================================================================
  function setFilter(filterKey) {
    if (!state.filterNames[filterKey]) return;
    state.currentFilter = filterKey;
    playPopSound(540);

    // Update gallery active states
    dom.filterCards.forEach((card) => {
      if (card.dataset.filter === filterKey) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        card.classList.remove('active');
      }
    });

    const info = state.filterNames[filterKey];
    dom.activeFilterBadge.querySelector('.filter-badge-icon').textContent = info.icon;
    dom.activeFilterBadge.querySelector('.filter-badge-text').textContent = info.name;
    dom.gallerySelectedName.textContent = info.name;
  }

  // Filter Cards Click
  dom.filterCards.forEach((card) => {
    card.addEventListener('click', () => {
      setFilter(card.dataset.filter);
    });
  });

  // Filter Intensity Slider
  dom.intensitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.filterIntensity = val / 100;
    dom.intensityValText.textContent = `${val}%`;
  });

  // Reset Filter Button
  dom.clearFilterBtn.addEventListener('click', () => {
    setFilter('none');
    showToast('Filter reset to Original');
  });

  // Camera Actions
  dom.startCameraBtn.addEventListener('click', startCamera);
  dom.retryCameraBtn.addEventListener('click', startCamera);
  dom.demoModeBtn.addEventListener('click', startDemoMode);
  dom.flipCameraBtn.addEventListener('click', flipCamera);
  dom.mirrorToggleBtn.addEventListener('click', toggleMirror);
  dom.capturePhotoBtn.addEventListener('click', capturePhoto);

  // Sound Toggle
  dom.soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    const onIcon = dom.soundToggleBtn.querySelector('.icon-sound-on');
    const offIcon = dom.soundToggleBtn.querySelector('.icon-sound-off');
    if (state.soundEnabled) {
      onIcon.classList.remove('hidden');
      offIcon.classList.add('hidden');
      showToast('Sound Effects: Enabled 🔔');
      playPopSound(600);
    } else {
      onIcon.classList.add('hidden');
      offIcon.classList.remove('hidden');
      showToast('Sound Effects: Muted 🔕');
    }
  });

  // Privacy Info Modal
  dom.privacyInfoBtn.addEventListener('click', () => {
    playPopSound(480);
    dom.privacyModal.classList.remove('hidden');
  });
  dom.closePrivacyBtn.addEventListener('click', () => {
    dom.privacyModal.classList.add('hidden');
  });
  dom.understandPrivacyBtn.addEventListener('click', () => {
    dom.privacyModal.classList.add('hidden');
  });

  // Snapshot Modal Close / Retake
  dom.closeModalBtn.addEventListener('click', () => {
    dom.snapshotModal.classList.add('hidden');
  });
  dom.retakePhotoBtn.addEventListener('click', () => {
    playPopSound(420);
    dom.snapshotModal.classList.add('hidden');
  });

  // Keyboard Navigation Shortcuts
  window.addEventListener('keydown', (e) => {
    // If typing in an input, don't intercept
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (dom.snapshotModal.classList.contains('hidden') && dom.privacyModal.classList.contains('hidden')) {
        capturePhoto();
      }
    } else if (e.code === 'Escape') {
      dom.snapshotModal.classList.add('hidden');
      dom.privacyModal.classList.add('hidden');
    } else if (e.code === 'KeyM') {
      toggleMirror();
    } else if (e.code === 'KeyF') {
      flipCamera();
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const keys = Object.keys(state.filterNames);
      const currIdx = keys.indexOf(state.currentFilter);
      if (e.code === 'ArrowRight') {
        const nextIdx = (currIdx + 1) % keys.length;
        setFilter(keys[nextIdx]);
      } else {
        const prevIdx = (currIdx - 1 + keys.length) % keys.length;
        setFilter(keys[prevIdx]);
      }
    }
  });

  // Handle Window Resize
  window.addEventListener('resize', () => {
    if (state.isCameraRunning && dom.video.videoWidth) {
      state.videoWidth = dom.video.videoWidth;
      state.videoHeight = dom.video.videoHeight;
      dom.canvas.width = state.videoWidth;
      dom.canvas.height = state.videoHeight;
    }
  });

  // Clean up on tab unload
  window.addEventListener('beforeunload', () => {
    stopCamera();
  });

  console.log('FaceFX Studio initialized successfully.');
})();
