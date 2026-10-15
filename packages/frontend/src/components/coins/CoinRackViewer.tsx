import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { NavItem, OllamaStatus } from '../../types';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  UploadCloud,
  Check,
  Command,
  HelpCircle,
  Eye,
  Activity
} from 'lucide-react';
import { COIN_FEATURES, type CoinFeature } from './coinData';

export { COIN_FEATURES, type CoinFeature };

interface CoinRackViewerProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  removedCoins: string[];
  onRestoreCoins: () => void;
  ollamaStatus: OllamaStatus | null;
  onOpenUpload: () => void;
  reviewCount: number;
}

export const CoinRackViewer: React.FC<CoinRackViewerProps> = ({
  currentTab,
  onSelectTab,
  removedCoins,
  onRestoreCoins,
  ollamaStatus,
  onOpenUpload,
  reviewCount
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Discrete React state ONLY for UI overlays and accessibility
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [activeUiIndex, setActiveUiIndex] = useState(() => {
    const idx = COIN_FEATURES.findIndex(f => f.id === currentTab);
    return idx !== -1 ? idx : 0;
  });

  // Performance FPS display
  const [currentFps, setCurrentFps] = useState(60);

  // Mutable animation state in REFS (zero React re-renders during high-frequency interactions!)
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  const removedCoinsRef = useRef<Set<string>>(new Set(removedCoins));
  removedCoinsRef.current = new Set(removedCoins);

  const onSelectTabRef = useRef(onSelectTab);
  onSelectTabRef.current = onSelectTab;

  // Continuous conveyor positioning & velocity damping
  const SPACING = 2.0;
  const TOTAL_COINS = COIN_FEATURES.length;
  const START_X = -((TOTAL_COINS - 1) * SPACING) / 2;

  const initialTabIdx = COIN_FEATURES.findIndex(f => f.id === currentTab);
  const currentPosRef = useRef<number>(initialTabIdx !== -1 ? initialTabIdx : 0);
  const targetPosRef = useRef<number>(initialTabIdx !== -1 ? initialTabIdx : 0);
  const velocityRef = useRef<number>(0);

  // Pointer & Raycasting state in REFS
  const pointerNormRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const isPointerInsideRef = useRef(false);
  const hoveredCoinIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const dragLastTimeRef = useRef(0);
  const dragVelocityRef = useRef(0);

  // Coin selection & pickup animation state
  const pickingUpIdRef = useRef<string | null>(null);
  const pickingUpProgressRef = useRef(0);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const camLookAtXRef = useRef<number>(0);
  const activeSpotlightRef = useRef<THREE.PointLight | null>(null);

  // Array of coin items with direct mesh handles
  const coinItemsRef = useRef<Array<{
    group: THREE.Group;
    coinMesh: THREE.Mesh;
    haloMesh: THREE.Mesh;
    emptyGlowMesh: THREE.Mesh;
    feature: CoinFeature;
    index: number;
    baseX: number;
  }>>([]);

  // Sync target pos if currentTab changes from parent
  useEffect(() => {
    const idx = COIN_FEATURES.findIndex(f => f.id === currentTab);
    if (idx !== -1) {
      targetPosRef.current = idx;
    }
  }, [currentTab]);

  // Handle coin selection trigger
  const triggerCoinSelection = useCallback((featureId: NavItem) => {
    if (pickingUpIdRef.current) return;
    pickingUpIdRef.current = featureId;
    pickingUpProgressRef.current = 0;

    // Smooth pickup sequence before workspace opening
    setTimeout(() => {
      onSelectTabRef.current(featureId);
      pickingUpIdRef.current = null;
      pickingUpProgressRef.current = 0;
    }, 400);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        targetPosRef.current = Math.min(targetPosRef.current + 1, TOTAL_COINS - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        targetPosRef.current = Math.max(targetPosRef.current - 1, 0);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeIdx = Math.round(targetPosRef.current);
        const feature = COIN_FEATURES[activeIdx];
        if (feature && !removedCoinsRef.current.has(feature.id)) {
          triggerCoinSelection(feature.id);
        }
      } else if (e.key === 'r' && e.altKey) {
        onRestoreCoins();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [TOTAL_COINS, onRestoreCoins, triggerCoinSelection]);

  // Helper to pre-render coin face texture once
  const createCoinFaceTexture = useCallback((feature: CoinFeature): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Dark circular face background
    ctx.fillStyle = feature.faceColor;
    ctx.beginPath();
    ctx.arc(256, 256, 252, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer polished metallic border rim ring
    ctx.lineWidth = 24;
    ctx.strokeStyle = feature.color;
    ctx.stroke();

    // 3. Inner concentric groove ring
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(256, 256, 226, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary subtle decorative dashed ring
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(256, 256, 204, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Subtle inner radial vignette/metallic sheen
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 224);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 222, 0, Math.PI * 2);
    ctx.fill();

    // 5. Center Feature Name Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge symbol / icon on top
    ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = feature.color;
    ctx.fillText(feature.badgeIcon, 256, 170);

    // Primary Name (embossed, clean)
    const fontSize = feature.name.length > 11 ? 40 : 48;
    ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = feature.textColor;
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 14;
    ctx.fillText(feature.name, 256, 252);
    ctx.shadowBlur = 0;

    // Subtitle under name
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(feature.subtext, 256, 320);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // Shared knurled rim bump texture created once
  const sharedReededBump = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 32);

    for (let x = 0; x < 512; x += 4) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 0, 2, 32);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + 2, 0, 2, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(18, 1);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // =========================================================================
  // MASTER THREE.JS LIFECYCLE (MOUNTED ONCE - ZERO UNNECESSARY RECREATION!)
  // =========================================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050a0b); // #050A0B
    scene.fog = new THREE.FogExp2(0x050a0b, 0.026);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 80);
    camera.position.set(-2.0, 3.2, 9.2);
    camera.lookAt(0.5, 0.8, -0.4);
    cameraRef.current = camera;

    // 3. WebGL Renderer with performance-capped DPR
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    // Target DPR: capped at 1.5 to prevent GPU fill-rate throttling on Retina screens
    const targetPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setSize(width, height);
    renderer.setPixelRatio(targetPixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x0b1714, 2.2);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    mainKeyLight.position.set(6, 14, 9);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.camera.near = 0.5;
    mainKeyLight.shadow.camera.far = 28;
    mainKeyLight.shadow.bias = -0.0005;
    scene.add(mainKeyLight);

    const tealBackLight = new THREE.DirectionalLight(0x00d6a0, 2.6);
    tealBackLight.position.set(-12, 5, -8);
    scene.add(tealBackLight);

    const violetFillLight = new THREE.DirectionalLight(0xb45bff, 2.0);
    violetFillLight.position.set(10, -3, 6);
    scene.add(violetFillLight);

    // Dynamic spotlight tracking focused coin
    const activeSpotlight = new THREE.PointLight(0x00d6a0, 4.2, 7, 1.2);
    activeSpotlight.position.set(0, 1.5, 1.2);
    scene.add(activeSpotlight);
    activeSpotlightRef.current = activeSpotlight;

    // Background floating dust particles
    const particleCount = 90;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 32;
      particlePositions[i + 1] = Math.random() * 14 - 2;
      particlePositions[i + 2] = (Math.random() - 0.5) * 20 - 5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x68ffe0,
      size: 0.05,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Shared Geometries (REUSED FOR ALL COINS & SLOTS - NO DUPLICATE MEMORY ALLOCATION!)
    const coinGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.25, 48);
    const pedestalGeo = new THREE.BoxGeometry(1.6, 0.9, 2.1);
    const grooveGeo = new THREE.BoxGeometry(0.38, 0.32, 1.7);
    const ledGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24);
    ledGeo.rotateX(Math.PI / 2);
    const streakGeo = new THREE.PlaneGeometry(0.48, 0.7);
    const emptyGlowGeo = new THREE.RingGeometry(0.2, 0.7, 24);
    const haloGeo = new THREE.PlaneGeometry(1.5, 1.5);

    // Shared materials
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0b1714,
      metalness: 0.7,
      roughness: 0.3
    });
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x030706,
      roughness: 0.95
    });

    // 6. Conveyor Group
    const coinsGroup = new THREE.Group();
    coinsGroup.rotation.y = 0.26;
    coinsGroup.rotation.x = 0.035;
    scene.add(coinsGroup);

    const TOTAL_WIDTH = (TOTAL_COINS - 1) * SPACING;

    // Continuous metallic base rail
    const rackBaseGeo = new THREE.BoxGeometry(TOTAL_WIDTH + 8, 0.75, 2.8);
    const rackBaseMat = new THREE.MeshStandardMaterial({
      color: 0x071b19,
      roughness: 0.35,
      metalness: 0.8
    });
    const rackBaseMesh = new THREE.Mesh(rackBaseGeo, rackBaseMat);
    rackBaseMesh.position.set(0, -0.55, 0);
    rackBaseMesh.receiveShadow = true;
    coinsGroup.add(rackBaseMesh);

    // Edge neon wire on the rail
    const edgeNeonGeo = new THREE.BoxGeometry(TOTAL_WIDTH + 8, 0.05, 0.05);
    const edgeNeonMat = new THREE.MeshBasicMaterial({ color: 0x00d6a0 });
    const edgeNeonMesh = new THREE.Mesh(edgeNeonGeo, edgeNeonMat);
    edgeNeonMesh.position.set(0, -0.16, 1.4);
    coinsGroup.add(edgeNeonMesh);

    // Build the 10 slots & coins
    const items: Array<{
      group: THREE.Group;
      coinMesh: THREE.Mesh;
      haloMesh: THREE.Mesh;
      emptyGlowMesh: THREE.Mesh;
      feature: CoinFeature;
      index: number;
      baseX: number;
    }> = [];

    const interactiveCoins: THREE.Mesh[] = [];

    COIN_FEATURES.forEach((feature, idx) => {
      const posX = START_X + idx * SPACING;

      // Pedestal Block
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(posX, -0.15, 0);

      const blockMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
      blockMesh.receiveShadow = true;
      pedestalGroup.add(blockMesh);

      // Slot groove
      const grooveMesh = new THREE.Mesh(grooveGeo, grooveMat);
      grooveMesh.position.set(0, 0.38, 0);
      pedestalGroup.add(grooveMesh);

      // LED indicator
      const ledMat = new THREE.MeshBasicMaterial({ color: feature.ledColor });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0, -0.08, 1.06);
      pedestalGroup.add(ledMesh);

      // Vertical light streak
      const streakCanvas = document.createElement('canvas');
      streakCanvas.width = 64;
      streakCanvas.height = 128;
      const sCtx = streakCanvas.getContext('2d')!;
      const sGrad = sCtx.createLinearGradient(0, 0, 0, 128);
      sGrad.addColorStop(0, feature.color);
      sGrad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.fillStyle = sGrad;
      sCtx.fillRect(0, 0, 64, 128);
      const streakTex = new THREE.CanvasTexture(streakCanvas);
      streakTex.generateMipmaps = false;
      const streakMat = new THREE.MeshBasicMaterial({
        map: streakTex,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const streakMesh = new THREE.Mesh(streakGeo, streakMat);
      streakMesh.position.set(0, -0.5, 1.06);
      pedestalGroup.add(streakMesh);

      // Ghostly empty slot glow indicator
      const emptyGlowMat = new THREE.MeshBasicMaterial({
        color: feature.color,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      });
      const emptyGlowMesh = new THREE.Mesh(emptyGlowGeo, emptyGlowMat);
      emptyGlowMesh.rotation.x = -Math.PI / 2;
      emptyGlowMesh.position.set(0, 0.42, 0);
      pedestalGroup.add(emptyGlowMesh);

      coinsGroup.add(pedestalGroup);

      // 3D Coin Mesh Group
      const coinGroup = new THREE.Group();
      coinGroup.position.set(posX, 0.7, 0);

      const faceTex = createCoinFaceTexture(feature);

      // Fluted edge material
      const edgeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(feature.color),
        metalness: 0.92,
        roughness: 0.18,
        bumpMap: sharedReededBump,
        bumpScale: 0.09
      });

      // Front & back face materials
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        metalness: 0.48,
        roughness: 0.28
      });

      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, faceMat, faceMat]);
      coinMesh.rotation.x = Math.PI / 2; // Upright
      coinMesh.castShadow = true;
      coinMesh.receiveShadow = true;
      coinMesh.userData = { feature, index: idx };

      coinGroup.add(coinMesh);
      interactiveCoins.push(coinMesh);

      // Upward spotlight halo underneath coin
      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = 128;
      haloCanvas.height = 128;
      const hCtx = haloCanvas.getContext('2d')!;
      const hGrad = hCtx.createRadialGradient(64, 64, 0, 64, 64, 62);
      hGrad.addColorStop(0, feature.color);
      hGrad.addColorStop(0.35, feature.color);
      hGrad.addColorStop(1, 'rgba(0,0,0,0)');
      hCtx.fillStyle = hGrad;
      hCtx.fillRect(0, 0, 128, 128);
      const haloTex = new THREE.CanvasTexture(haloCanvas);
      haloTex.generateMipmaps = false;
      const haloMat = new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      haloMesh.position.y = -0.58;
      coinGroup.add(haloMesh);

      coinsGroup.add(coinGroup);

      items.push({
        group: coinGroup,
        coinMesh,
        haloMesh,
        emptyGlowMesh,
        feature,
        index: idx,
        baseX: posX
      });
    });

    coinItemsRef.current = items;

    // 7. Raycaster instance created once
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    // =========================================================================
    // EVENT LISTENERS (LIGHTWEIGHT, REACTIONARY, ZERO STATE RERENDERS)
    // =========================================================================
    const dom = renderer.domElement;

    // Wheel Scroll with frame-rate independent velocity damping
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Normalize delta across line vs pixel vs trackpad
      let delta = e.deltaY;
      if (Math.abs(delta) < 0.1 && Math.abs(e.deltaX) > 0.1) {
        delta = e.deltaX;
      }
      if (e.deltaMode === 1) delta *= 32; // lines
      else if (e.deltaMode === 2) delta *= 800; // pages

      // Clamp excessive deltas from violent trackpad flicks
      const clampedDelta = Math.max(-100, Math.min(100, delta));
      const sensitivity = 0.0032;

      // Add to target position with instant reversal response
      targetPosRef.current = Math.max(0, Math.min(TOTAL_COINS - 1, targetPosRef.current + clampedDelta * sensitivity));
    };

    // Pointer Down (Drag or Click)
    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartPosRef.current = targetPosRef.current;
      dragLastTimeRef.current = performance.now();
      dragVelocityRef.current = 0;

      // Raycast click
      if (hoveredCoinIndexRef.current !== null) {
        const feat = COIN_FEATURES[hoveredCoinIndexRef.current];
        if (feat && !removedCoinsRef.current.has(feat.id)) {
          triggerCoinSelection(feat.id);
        }
      }
    };

    // Pointer Move: update coordinates in refs only (ZERO React overhead!)
    const handlePointerMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerNormRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNormRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      isPointerInsideRef.current = true;

      // Drag translation
      if (isDraggingRef.current) {
        const deltaX = e.clientX - dragStartXRef.current;
        const now = performance.now();
        const dt = Math.max(1, now - dragLastTimeRef.current);
        dragVelocityRef.current = -deltaX / dt;
        dragLastTimeRef.current = now;

        // Diagonal sensitivity
        const dragFactor = 0.0045;
        targetPosRef.current = Math.max(0, Math.min(TOTAL_COINS - 1, dragStartPosRef.current - deltaX * dragFactor));
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Snap smoothly to nearest integer coin slot upon drag release
        targetPosRef.current = Math.max(0, Math.min(TOTAL_COINS - 1, Math.round(targetPosRef.current)));
      }
    };

    const handlePointerLeave = () => {
      isPointerInsideRef.current = false;
      hoveredCoinIndexRef.current = null;
      dom.style.cursor = 'default';
    };

    // Attach listeners
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('pointerleave', handlePointerLeave);

    // =========================================================================
    // 8. MASTER ANIMATION LOOP (LOCKED 60 FPS, FRAME-INDEPENDENT DAMPING)
    // =========================================================================
    let clock = new THREE.Clock();
    let frameCounter = 0;
    let fpsTimeAccum = 0;
    let lastUiSyncPos = -1;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1); // Clamp to prevent spiral of death
      const elapsedTime = clock.getElapsedTime();

      // FPS Monitoring (adaptive performance guard)
      frameCounter++;
      fpsTimeAccum += delta;
      if (fpsTimeAccum >= 1.0) {
        const measuredFps = Math.round(frameCounter / fpsTimeAccum);
        setCurrentFps(measuredFps);
        frameCounter = 0;
        fpsTimeAccum = 0;

        // Adaptive quality: lower DPR if sustained frame drops occur
        if (measuredFps < 48 && renderer.getPixelRatio() > 1.0) {
          renderer.setPixelRatio(1.0);
        } else if (measuredFps > 58 && renderer.getPixelRatio() < targetPixelRatio) {
          renderer.setPixelRatio(targetPixelRatio);
        }
      }

      // --- 1. Conveyor Smooth Damping (Frame-rate Independent) ---
      const targetPos = targetPosRef.current;
      // Exponential decay: responsive yet butter-smooth
      const dampingSpeed = isDraggingRef.current ? 24.0 : 12.0;
      const alpha = 1.0 - Math.exp(-dampingSpeed * delta);
      currentPosRef.current += (targetPos - currentPosRef.current) * alpha;

      const currentPos = currentPosRef.current;

      // Sync active discrete index to React UI card only when rounded integer actually changes!
      const roundedIndex = Math.max(0, Math.min(TOTAL_COINS - 1, Math.round(currentPos)));
      if (roundedIndex !== lastUiSyncPos) {
        lastUiSyncPos = roundedIndex;
        setActiveUiIndex(roundedIndex);
      }

      // --- 2. Camera Tracking along Conveyor Diagonal ---
      const focusX = START_X + currentPos * SPACING;
      const targetCamX = -2.0 + focusX * 0.85;
      camera.position.x += (targetCamX - camera.position.x) * (1.0 - Math.exp(-10.0 * delta));

      const targetLookX = focusX * 0.9;
      camLookAtXRef.current += (targetLookX - camLookAtXRef.current) * (1.0 - Math.exp(-10.0 * delta));
      camera.lookAt(camLookAtXRef.current, 0.85, -0.4);

      // --- 3. Dynamic Spotlight Tracking ---
      if (activeSpotlightRef.current) {
        const activeColor = new THREE.Color(COIN_FEATURES[roundedIndex].color);
        activeSpotlightRef.current.color.lerp(activeColor, 0.15);
        activeSpotlightRef.current.position.x += (focusX - activeSpotlightRef.current.position.x) * (1.0 - Math.exp(-14.0 * delta));
      }

      // --- 4. Background Particle Animation ---
      particles.rotation.y = elapsedTime * 0.02;

      // --- 5. Optimized Raycasting (Once per frame, only interactive coins) ---
      if (isPointerInsideRef.current && !isDraggingRef.current) {
        mouseVector.set(pointerNormRef.current.x, pointerNormRef.current.y);
        raycaster.setFromCamera(mouseVector, camera);
        const intersects = raycaster.intersectObjects(interactiveCoins, false);

        if (intersects.length > 0) {
          const hitIdx = intersects[0].object.userData.index;
          const hitFeature = intersects[0].object.userData.feature as CoinFeature;
          if (!removedCoinsRef.current.has(hitFeature.id)) {
            hoveredCoinIndexRef.current = hitIdx;
            dom.style.cursor = 'pointer';
          } else {
            hoveredCoinIndexRef.current = null;
            dom.style.cursor = 'default';
          }
        } else {
          hoveredCoinIndexRef.current = null;
          dom.style.cursor = 'default';
        }
      }

      // --- 6. Transform Every Coin (High-Performance Direct Transforms) ---
      const isPlayingLoop = isPlayingRef.current;
      const pickingUpId = pickingUpIdRef.current;
      const removedCoinsSet = removedCoinsRef.current;

      items.forEach(({ group, haloMesh, emptyGlowMesh, feature, index }) => {
        const isRemoved = removedCoinsSet.has(feature.id);
        const isBeingPickedUp = pickingUpId === feature.id;
        const isHovered = hoveredCoinIndexRef.current === index;

        // Continuous distance from floating conveyor cursor
        const distFromFocus = Math.abs(currentPos - index);
        // Continuous proximity bell-curve: 1.0 when perfectly focused, 0.0 when 1.5 slots away
        const proximity = Math.max(0, 1.0 - distFromFocus * 0.8);

        if (isRemoved && !isBeingPickedUp) {
          // Absent: hide mesh, show faint glowing empty slot
          group.visible = false;
          (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
          return;
        }

        group.visible = true;
        (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;

        // Elevation calculation
        let targetY = 0.65;
        if (isBeingPickedUp) {
          pickingUpProgressRef.current = Math.min(1.0, pickingUpProgressRef.current + delta * 2.5);
          targetY = 0.65 + pickingUpProgressRef.current * 2.5; // Elevate high up
        } else {
          targetY = 0.65 + proximity * 0.95 + (isHovered ? 0.35 : 0.0);
        }

        group.position.y += (targetY - group.position.y) * (1.0 - Math.exp(-14.0 * delta));

        // Subtle idle rhythmic floating
        if (isPlayingLoop && !isBeingPickedUp) {
          const idleWave = Math.sin(elapsedTime * 2.2 + index * 0.5) * 0.035;
          const idleTilt = Math.cos(elapsedTime * 1.8 + index * 0.4) * 0.04;
          group.rotation.y = idleTilt * proximity;
          group.position.y += idleWave * proximity;
        }

        // Camera tilt & scaling based on proximity
        let targetRotX = -0.14 * proximity;
        let targetScale = 1.0 + 0.06 * proximity;

        if (isBeingPickedUp) {
          targetRotX = -0.3;
          targetScale = 1.0 + pickingUpProgressRef.current * 0.25;
          group.rotation.y += delta * 6.0; // Fast dramatic spin
        }

        group.rotation.x += (targetRotX - group.rotation.x) * (1.0 - Math.exp(-12.0 * delta));
        group.scale.set(targetScale, targetScale, targetScale);

        // Halo opacity underneath
        if (haloMesh && haloMesh.material instanceof THREE.MeshBasicMaterial) {
          const targetHaloOpacity = isBeingPickedUp ? 1.0 : (proximity * 0.85 + (isHovered ? 0.35 : 0.0));
          haloMesh.material.opacity += (targetHaloOpacity - haloMesh.material.opacity) * (1.0 - Math.exp(-12.0 * delta));
        }
      });

      // Render the scene
      renderer.render(scene, camera);
    };

    animate();

    // Window resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // =========================================================================
    // CLEANUP ON UNMOUNT (GENUINE UNMOUNT ONLY)
    // =========================================================================
    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('pointerleave', handlePointerLeave);

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      // Clean disposal
      coinGeo.dispose();
      pedestalGeo.dispose();
      grooveGeo.dispose();
      ledGeo.dispose();
      streakGeo.dispose();
      emptyGlowGeo.dispose();
      haloGeo.dispose();
      pedestalMat.dispose();
      grooveMat.dispose();
      sharedReededBump.dispose();

      if (dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
      renderer.dispose();
    };
  }, [TOTAL_COINS, createCoinFaceTexture, sharedReededBump, triggerCoinSelection]);

  const activeFeature = COIN_FEATURES[activeUiIndex] || COIN_FEATURES[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050A0B] select-none text-slate-100">
      {/* 1. Cinematic Background Vignette & Gradients */}
      <div className="absolute inset-0 bg-radial from-transparent via-[#050A0B]/60 to-[#050A0B] pointer-events-none z-0" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 2. Top Cinematic Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between pointer-events-none">
        {/* Brand Identity */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shadow-lg shadow-emerald-950/60">
              <div className="w-full h-full bg-[#071b19] rounded-[11px] flex items-center justify-center text-emerald-400 font-bold text-base">
                ◈
              </div>
            </div>
            <div>
              <div className="text-base font-black tracking-wider text-white flex items-center gap-2">
                <span>LedgerLens</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Private AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Your invoices, organized. Your data, yours.
              </p>
            </div>
          </div>
        </div>

        {/* Top Center Controls / Status */}
        <div className="hidden md:flex items-center gap-3 pointer-events-auto">
          {/* FPS Monitor Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0b1714]/80 backdrop-blur-md border border-slate-800 text-xs font-mono text-slate-300">
            <Activity className="size-3 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{currentFps}</span>
            <span className="text-[10px] text-slate-400">FPS</span>
          </div>

          {/* Ollama Status Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b1714]/80 backdrop-blur-md border border-emerald-500/20 text-xs font-mono">
            <span className={`size-2 rounded-full ${ollamaStatus?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300">Gemma 3:4b</span>
            <span className="text-emerald-400 font-semibold">{ollamaStatus?.isOnline ? 'Active' : 'Offline'}</span>
          </div>

          {/* Review Queue Count Pill if any */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{reviewCount} Needs Review</span>
            </div>
          )}
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Upload CTA */}
          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <UploadCloud className="size-3.5" />
            <span>Import Invoices</span>
          </button>

          {/* 3D Loop Play/Pause */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="p-2 rounded-xl bg-[#0b1714]/80 hover:bg-[#122822] border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isPlaying ? 'Pause 3D Loop' : 'Resume 3D Loop'}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>

          {/* Keyboard Help */}
          <button
            onClick={() => setShowHelp(h => !h)}
            className="p-2 rounded-xl bg-[#0b1714]/80 hover:bg-[#122822] border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Interactive Controls"
          >
            <HelpCircle className="size-4" />
          </button>
        </div>
      </header>

      {/* 3. 3D WebGL Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10"
      />

      {/* 4. Bottom Focused Coin Card & Navigation HUD */}
      <footer className="absolute bottom-6 left-6 right-6 z-20 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none">
        {/* Left: Focused Coin Card */}
        <div className="pointer-events-auto p-4 rounded-2xl bg-[#0b1714]/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl max-w-md w-full flex items-start gap-4">
          <div
            className="size-12 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 shadow-lg"
            style={{
              backgroundColor: `${activeFeature.color}15`,
              border: `1.5px solid ${activeFeature.color}50`,
              color: activeFeature.color
            }}
          >
            {activeFeature.badgeIcon}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-white tracking-wide truncate">
                {activeFeature.name}
              </h2>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
                style={{
                  backgroundColor: `${activeFeature.color}20`,
                  color: activeFeature.color,
                  border: `1px solid ${activeFeature.color}40`
                }}
              >
                {activeFeature.subtext}
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {activeFeature.description}
            </p>
          </div>
        </div>

        {/* Center: Conveyor Navigation Dots / Stepper */}
        <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-full bg-[#0b1714]/90 backdrop-blur-md border border-slate-800/80 shadow-xl">
          <button
            onClick={() => {
              targetPosRef.current = Math.max(targetPosRef.current - 1, 0);
            }}
            disabled={activeUiIndex === 0}
            className="p-1.5 rounded-full text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Previous Coin (Left Arrow)"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            {COIN_FEATURES.map((feat, idx) => {
              const isFoc = idx === activeUiIndex;
              const isRem = removedCoins.includes(feat.id);
              return (
                <button
                  key={feat.id}
                  onClick={() => {
                    targetPosRef.current = idx;
                  }}
                  className={`transition-all rounded-full cursor-pointer ${
                    isFoc
                      ? 'w-6 h-2 bg-emerald-400 shadow-md shadow-emerald-400/50'
                      : isRem
                      ? 'w-2 h-2 bg-slate-700 opacity-40'
                      : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
                  }`}
                  title={`${feat.name} ${isRem ? '(In Use)' : ''}`}
                />
              );
            })}
          </div>

          <button
            onClick={() => {
              targetPosRef.current = Math.min(targetPosRef.current + 1, TOTAL_COINS - 1);
            }}
            disabled={activeUiIndex === TOTAL_COINS - 1}
            className="p-1.5 rounded-full text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Next Coin (Right Arrow)"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Right: Pick-Up & Open Workspace Actions */}
        <div className="pointer-events-auto flex items-center gap-3">
          {/* Restore Removed Coins Action if any are absent */}
          {removedCoins.length > 0 && (
            <button
              onClick={onRestoreCoins}
              className="px-3.5 py-2.5 rounded-xl bg-[#0b1714]/90 hover:bg-[#122822] border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Return all picked up coins to the conveyor rack"
            >
              <RotateCcw className="size-3.5" />
              <span>Restore Coins ({removedCoins.length})</span>
            </button>
          )}

          {/* Launch Coin Workspace Button */}
          <button
            onClick={() => triggerCoinSelection(activeFeature.id)}
            disabled={removedCoins.includes(activeFeature.id)}
            className="px-6 py-2.5 rounded-xl font-extrabold text-xs tracking-wide shadow-xl flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer text-black disabled:opacity-40"
            style={{
              backgroundColor: activeFeature.color,
              boxShadow: `0 8px 24px ${activeFeature.color}40`
            }}
          >
            <span>{`Open ${activeFeature.name}`}</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </footer>

      {/* 5. Interactive Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#0b1714] border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Command className="size-4 text-emerald-400" />
                3D Conveyor Navigation
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Navigate between coins</span>
                <span className="font-mono text-emerald-400 font-bold">← / → or A / D</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Pick up & open workspace</span>
                <span className="font-mono text-emerald-400 font-bold">Enter / Space / Click</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Slide conveyor rack</span>
                <span className="font-mono text-emerald-400 font-bold">Drag / Mouse Wheel</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Return to conveyor</span>
                <span className="font-mono text-emerald-400 font-bold">Esc</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Restore removed coins</span>
                <span className="font-mono text-emerald-400 font-bold">Alt + R</span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoinRackViewer;
