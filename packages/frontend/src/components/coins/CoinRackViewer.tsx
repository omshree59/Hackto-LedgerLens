import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { NavItem } from '../../types';
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
  Eye
} from 'lucide-react';
import type { OllamaStatus } from '../../types';

export interface CoinFeature {
  id: NavItem;
  name: string;
  subtext: string;
  color: string;       // Rim & glow accent color
  faceColor: string;   // Face background color
  textColor: string;   // Text label color
  ledColor: string;    // Pedestal LED color
  badgeIcon: string;   // Short symbol or icon
  description: string;
}

export const COIN_FEATURES: CoinFeature[] = [
  {
    id: 'overview',
    name: 'Overview',
    subtext: 'Analytics & KPIs',
    color: '#00D6A0',
    faceColor: '#061a15',
    textColor: '#F2F7F5',
    ledColor: '#00D6A0',
    badgeIcon: '⊞',
    description: 'Executive financial dashboard with spend trends, categorized summaries, and real-time KPIs.'
  },
  {
    id: 'invoices',
    name: 'Invoices',
    subtext: 'Accounts Payable',
    color: '#B45BFF',
    faceColor: '#180a2b',
    textColor: '#F2F7F5',
    ledColor: '#B45BFF',
    badgeIcon: '📄',
    description: 'Full-featured accounts payable registry with OCR confidence badges and fast payment tracking.'
  },
  {
    id: 'receipts',
    name: 'Receipts',
    subtext: 'Expense Slips',
    color: '#3185FF',
    faceColor: '#09182f',
    textColor: '#F2F7F5',
    ledColor: '#3185FF',
    badgeIcon: '🧾',
    description: 'Instant slip categorization, merchant parsing, and multi-currency exchange conversion.'
  },
  {
    id: 'review',
    name: 'Review Queue',
    subtext: 'Verification AI',
    color: '#FFB000',
    faceColor: '#261803',
    textColor: '#F2F7F5',
    ledColor: '#FFB000',
    badgeIcon: '⚠',
    description: 'Side-by-side document verification workspace for low-confidence fields and duplicate collisions.'
  },
  {
    id: 'vendors',
    name: 'Vendors',
    subtext: 'Merchant Profiles',
    color: '#06B6D4',
    faceColor: '#061c24',
    textColor: '#F2F7F5',
    ledColor: '#06B6D4',
    badgeIcon: '🏢',
    description: 'Merchant directory with historical spend aggregations, contact details, and vendor deduplication.'
  },
  {
    id: 'expenses',
    name: 'Expenses',
    subtext: 'Ledger Records',
    color: '#059669',
    faceColor: '#041f15',
    textColor: '#F2F7F5',
    ledColor: '#059669',
    badgeIcon: '💳',
    description: 'Recorded business expenses linked to verified source documents with one-click export.'
  },
  {
    id: 'rules',
    name: 'Automation',
    subtext: 'Gemma Workflows',
    color: '#7B35FF',
    faceColor: '#190b30',
    textColor: '#F2F7F5',
    ledColor: '#7B35FF',
    badgeIcon: '✦',
    description: 'Automated categorization and threshold rules interpreted and created by local Gemma AI.'
  },
  {
    id: 'reports',
    name: 'Reports',
    subtext: 'Tax & Subtotals',
    color: '#2563EB',
    faceColor: '#081630',
    textColor: '#F2F7F5',
    ledColor: '#2563EB',
    badgeIcon: '📊',
    description: 'Annual fiscal reports, deductible tax calculations, and local folder file reorganization.'
  },
  {
    id: 'local_ai',
    name: 'Local AI',
    subtext: 'Ollama & Gemma Hub',
    color: '#68FFE0',
    faceColor: '#041c19',
    textColor: '#F2F7F5',
    ledColor: '#68FFE0',
    badgeIcon: '⚙',
    description: 'Live AI diagnostic playground, on-device model weights, latency benchmarks, and privacy controls.'
  },
  {
    id: 'settings',
    name: 'Settings',
    subtext: 'Privacy & Storage',
    color: '#94A3B8',
    faceColor: '#141c24',
    textColor: '#F2F7F5',
    ledColor: '#94A3B8',
    badgeIcon: '🛡',
    description: 'Local SQLite database management, storage metrics, category taxonomies, and system backups.'
  }
];

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const idx = COIN_FEATURES.findIndex(f => f.id === currentTab);
    return idx !== -1 ? idx : 0;
  });
  const [hoveredFeature, setHoveredFeature] = useState<CoinFeature | null>(null);
  const [isPickingUp, setIsPickingUp] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const coinsGroupRef = useRef<THREE.Group | null>(null);
  const coinMeshesRef = useRef<Array<{
    group: THREE.Group;
    coinMesh: THREE.Mesh;
    haloMesh: THREE.Mesh;
    emptyGlowMesh: THREE.Mesh;
    feature: CoinFeature;
    index: number;
  }>>([]);
  const animFrameRef = useRef<number | null>(null);
  const camLookAtXRef = useRef<number>(0);
  const activeSpotlightRef = useRef<THREE.PointLight | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollOffsetRef = useRef(0);

  // Update focused index if currentTab changes externally
  useEffect(() => {
    const idx = COIN_FEATURES.findIndex(f => f.id === currentTab);
    if (idx !== -1) setFocusedIndex(idx);
  }, [currentTab]);

  // Helper to generate crisp canvas texture for coin face
  const createCoinFaceTexture = (feature: CoinFeature): THREE.CanvasTexture => {
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
    return texture;
  };

  // Helper to generate reeded / knurled coin edge bump map
  const createReededBumpTexture = (): THREE.CanvasTexture => {
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
    return texture;
  };

  // Handle coin selection with cinematic pickup animation
  const handleSelectCoin = useCallback((featureId: NavItem) => {
    if (isPickingUp) return;
    setIsPickingUp(featureId);

    // Brief cinematic elevation before transitioning into workspace
    setTimeout(() => {
      onSelectTab(featureId);
      setIsPickingUp(null);
    }, 450);
  }, [isPickingUp, onSelectTab]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, COIN_FEATURES.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const active = COIN_FEATURES[focusedIndex];
        if (active) handleSelectCoin(active.id);
      } else if (e.key === 'r' && e.altKey) {
        onRestoreCoins();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, handleSelectCoin, onRestoreCoins]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050a0b); // #050A0B cinematic obsidian
    scene.fog = new THREE.FogExp2(0x050a0b, 0.028);

    // 2. Camera - Angled diagonal perspective matching reference image
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(-2.0, 3.2, 9.2);
    camera.lookAt(0.5, 0.8, -0.4);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Atmospheric Lights
    const ambientLight = new THREE.AmbientLight(0x0b1714, 2.2);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    mainKeyLight.position.set(6, 14, 9);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.camera.near = 0.5;
    mainKeyLight.shadow.camera.far = 30;
    scene.add(mainKeyLight);

    const tealBackLight = new THREE.DirectionalLight(0x00d6a0, 2.8);
    tealBackLight.position.set(-12, 5, -8);
    scene.add(tealBackLight);

    const violetFillLight = new THREE.DirectionalLight(0xb45bff, 2.2);
    violetFillLight.position.set(10, -3, 6);
    scene.add(violetFillLight);

    // Dynamic spotlight tracking the focused coin
    const activeSpotlight = new THREE.PointLight(0x00d6a0, 4.5, 7, 1.2);
    activeSpotlight.position.set(0, 1.5, 1.2);
    scene.add(activeSpotlight);
    activeSpotlightRef.current = activeSpotlight;

    // Background floating dust particles
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 30;
      particlePositions[i + 1] = Math.random() * 12 - 2;
      particlePositions[i + 2] = (Math.random() - 0.5) * 20 - 5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x68ffe0,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Coin Conveyor Assembly
    const coinsGroup = new THREE.Group();
    coinsGroupRef.current = coinsGroup;

    // Diagonal angle perspective (stretching diagonally across viewport)
    coinsGroup.rotation.y = 0.26;
    coinsGroup.rotation.x = 0.035;
    scene.add(coinsGroup);

    const SPACING = 1.95;
    const TOTAL_WIDTH = (COIN_FEATURES.length - 1) * SPACING;
    const START_X = -TOTAL_WIDTH / 2;

    const reededBump = createReededBumpTexture();
    const coinMeshes: Array<{
      group: THREE.Group;
      coinMesh: THREE.Mesh;
      haloMesh: THREE.Mesh;
      emptyGlowMesh: THREE.Mesh;
      feature: CoinFeature;
      index: number;
    }> = [];

    // Continuous metallic base rail underneath the slots
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

    // Build the 10 slots and coins
    COIN_FEATURES.forEach((feature, idx) => {
      const posX = START_X + idx * SPACING;

      // Pedestal Block Group
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(posX, -0.15, 0);

      // Block Mesh
      const blockGeo = new THREE.BoxGeometry(1.6, 0.9, 2.1);
      const blockMat = new THREE.MeshStandardMaterial({
        color: 0x0b1714,
        metalness: 0.7,
        roughness: 0.3
      });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.receiveShadow = true;
      pedestalGroup.add(blockMesh);

      // Slot cutout groove for the coin
      const grooveGeo = new THREE.BoxGeometry(0.38, 0.32, 1.7);
      const grooveMat = new THREE.MeshStandardMaterial({ color: 0x030706, roughness: 0.95 });
      const grooveMesh = new THREE.Mesh(grooveGeo, grooveMat);
      grooveMesh.position.set(0, 0.38, 0);
      pedestalGroup.add(grooveMesh);

      // Front LED indicator badge (glowing disk from reference video)
      const ledGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 32);
      ledGeo.rotateX(Math.PI / 2);
      const ledMat = new THREE.MeshBasicMaterial({ color: feature.ledColor });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0, -0.08, 1.06);
      pedestalGroup.add(ledMesh);

      // Downward vertical light streak on pedestal front
      const streakGeo = new THREE.PlaneGeometry(0.48, 0.7);
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
      const streakMat = new THREE.MeshBasicMaterial({
        map: streakTex,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const streakMesh = new THREE.Mesh(streakGeo, streakMat);
      streakMesh.position.set(0, -0.5, 1.06);
      pedestalGroup.add(streakMesh);

      // Ghostly empty slot glow indicator (shown when coin is picked up / removed)
      const emptyGlowGeo = new THREE.RingGeometry(0.2, 0.7, 32);
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

      // 6. 3D COIN MESH
      const coinGroup = new THREE.Group();
      coinGroup.position.set(posX, 0.7, 0);

      const coinRadius = 1.18;
      const coinThickness = 0.25;

      const coinGeo = new THREE.CylinderGeometry(coinRadius, coinRadius, coinThickness, 64);
      const faceTex = createCoinFaceTexture(feature);

      // Edge material with reeded fluting bump
      const edgeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(feature.color),
        metalness: 0.92,
        roughness: 0.18,
        bumpMap: reededBump,
        bumpScale: 0.1
      });

      // Front & back face materials
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        metalness: 0.5,
        roughness: 0.28
      });

      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, faceMat, faceMat]);
      coinMesh.rotation.x = Math.PI / 2; // Stand upright
      coinMesh.castShadow = true;
      coinMesh.receiveShadow = true;

      coinGroup.userData = { feature, index: idx };
      coinMesh.userData = { feature, index: idx };

      coinGroup.add(coinMesh);

      // Upward spotlight halo underneath the coin for when it gets elevated
      const haloGeo = new THREE.PlaneGeometry(1.5, 1.5);
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

      coinMeshes.push({
        group: coinGroup,
        coinMesh,
        haloMesh,
        emptyGlowMesh,
        feature,
        index: idx
      });
    });

    coinMeshesRef.current = coinMeshes;

    // 7. Raycasting & Mouse Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(coinsGroup.children, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.feature && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.feature) {
          const feat = obj.userData.feature as CoinFeature;
          // Check if coin was removed
          if (!removedCoins.includes(feat.id)) {
            setFocusedIndex(obj.userData.index);
            handleSelectCoin(feat.id);
          }
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - dragStartXRef.current;
        if (Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            setFocusedIndex(prev => Math.min(prev + 1, COIN_FEATURES.length - 1));
          } else {
            setFocusedIndex(prev => Math.max(prev - 1, 0));
          }
          dragStartXRef.current = e.clientX;
        }
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(coinsGroup.children, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.feature && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.feature) {
          const feat = obj.userData.feature as CoinFeature;
          if (!removedCoins.includes(feat.id)) {
            setHoveredFeature(feat);
            renderer.domElement.style.cursor = 'pointer';
            return;
          }
        }
      }
      setHoveredFeature(null);
      renderer.domElement.style.cursor = 'default';
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 20 || e.deltaX > 20) {
        setFocusedIndex(prev => Math.min(prev + 1, COIN_FEATURES.length - 1));
      } else if (e.deltaY < -20 || e.deltaX < -20) {
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Continuous Render Loop (60-120 FPS Video-like motion)
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Camera smoothly tracks towards the focused coin along the diagonal
      const activeTargetX = START_X + focusedIndex * SPACING;
      const targetCamX = -2.0 + activeTargetX * 0.85;
      camera.position.x += (targetCamX - camera.position.x) * 0.07;

      const targetLookX = activeTargetX * 0.9;
      camLookAtXRef.current += (targetLookX - camLookAtXRef.current) * 0.07;
      camera.lookAt(camLookAtXRef.current, 0.85, -0.4);

      // Move spotlight to active coin
      if (activeSpotlightRef.current) {
        const activeColor = new THREE.Color(COIN_FEATURES[focusedIndex].color);
        activeSpotlightRef.current.color = activeColor;
        activeSpotlightRef.current.position.x += (activeTargetX - activeSpotlightRef.current.position.x) * 0.1;
      }

      // Animate particles slowly
      particles.rotation.y = elapsedTime * 0.02;

      // Animate each coin
      coinMeshes.forEach(({ group, haloMesh, emptyGlowMesh, feature, index }) => {
        const isRemoved = removedCoins.includes(feature.id);
        const isBeingPickedUp = isPickingUp === feature.id;
        const isFocused = index === focusedIndex;
        const isHovered = hoveredFeature?.id === feature.id;

        if (isRemoved && !isBeingPickedUp) {
          // Coin is absent: hide coin mesh, show faint ambient slot glow
          group.visible = false;
          (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
          return;
        }

        group.visible = true;
        (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;

        // Elevation target
        let targetY = 0.65;
        if (isBeingPickedUp) {
          targetY = 2.6; // Dramatic pick-up height
        } else if (isFocused) {
          targetY = 1.7; // Elevated in rack
        } else if (isHovered) {
          targetY = 1.05;
        }

        group.position.y += (targetY - group.position.y) * (isBeingPickedUp ? 0.2 : 0.12);

        // Continuous rhythmic idle loop
        if (isPlaying && !isBeingPickedUp) {
          const idleWave = Math.sin(elapsedTime * 2.2 + index * 0.5) * 0.035;
          const idleTilt = Math.cos(elapsedTime * 1.8 + index * 0.4) * 0.04;

          group.rotation.y = isFocused ? idleTilt * 0.7 : idleTilt * 0.3;
          if (isFocused) {
            group.position.y += idleWave * 0.5;
          }
        }

        // Tilt towards camera when elevated or picked up
        let targetRotX = 0.0;
        let targetScale = 1.0;
        if (isBeingPickedUp) {
          targetRotX = -0.25;
          targetScale = 1.15;
          group.rotation.y += 0.08; // Fast dramatic spin
        } else if (isFocused) {
          targetRotX = -0.12;
          targetScale = 1.04;
        }

        group.rotation.x += (targetRotX - group.rotation.x) * 0.1;
        group.scale.set(targetScale, targetScale, targetScale);

        // Halo spotlight mesh opacity underneath
        if (haloMesh && haloMesh.material instanceof THREE.MeshBasicMaterial) {
          const targetOpacity = isBeingPickedUp ? 1.0 : (isFocused ? 0.85 : (isHovered ? 0.4 : 0.0));
          haloMesh.material.opacity += (targetOpacity - haloMesh.material.opacity) * 0.12;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [focusedIndex, handleSelectCoin, isPlaying, isPickingUp, removedCoins]);

  const activeFeature = COIN_FEATURES[focusedIndex] || COIN_FEATURES[0];
  const isCurrentRemoved = removedCoins.includes(activeFeature.id);

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
            onClick={() => setFocusedIndex(prev => Math.max(prev - 1, 0))}
            disabled={focusedIndex === 0}
            className="p-1.5 rounded-full text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Previous Coin (Left Arrow)"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            {COIN_FEATURES.map((feat, idx) => {
              const isFoc = idx === focusedIndex;
              const isRem = removedCoins.includes(feat.id);
              return (
                <button
                  key={feat.id}
                  onClick={() => setFocusedIndex(idx)}
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
            onClick={() => setFocusedIndex(prev => Math.min(prev + 1, COIN_FEATURES.length - 1))}
            disabled={focusedIndex === COIN_FEATURES.length - 1}
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
            onClick={() => handleSelectCoin(activeFeature.id)}
            disabled={isPickingUp !== null}
            className="px-6 py-2.5 rounded-xl font-extrabold text-xs tracking-wide shadow-xl flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer text-black"
            style={{
              backgroundColor: activeFeature.color,
              boxShadow: `0 8px 24px ${activeFeature.color}40`
            }}
          >
            <span>{isPickingUp ? 'Picking up...' : `Open ${activeFeature.name}`}</span>
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
