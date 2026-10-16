import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { NavItem, OllamaStatus } from '../../types';
import { COIN_FEATURES, type CoinFeature } from './coinData';
import { AiStatusPill } from '../layout/AiStatusPill';
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
  Activity,
  Compass,
  Maximize2,
  Video,
  Layers,
  Camera
} from 'lucide-react';

export { COIN_FEATURES, type CoinFeature };

export type CameraPreset = 'cinematic' | 'front' | 'top' | 'isometric';

interface CameraPresetConfig {
  id: CameraPreset;
  label: string;
  icon: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_PRESETS: CameraPresetConfig[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    icon: '🎬',
    position: new THREE.Vector3(-2.0, 3.2, 9.2),
    target: new THREE.Vector3(0, 0.75, -0.4)
  },
  {
    id: 'front',
    label: 'Front',
    icon: '👁',
    position: new THREE.Vector3(0, 1.3, 8.8),
    target: new THREE.Vector3(0, 0.75, 0)
  },
  {
    id: 'top',
    label: 'Top',
    icon: '⬇',
    position: new THREE.Vector3(0, 11.2, 0.05),
    target: new THREE.Vector3(0, 0.75, 0)
  },
  {
    id: 'isometric',
    label: 'Isometric',
    icon: '📐',
    position: new THREE.Vector3(7.8, 6.2, 7.8),
    target: new THREE.Vector3(0, 0.75, 0)
  }
];

interface CoinRackViewerProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  removedCoins: string[];
  onRestoreCoins: () => void;
  ollamaStatus: OllamaStatus | null;
  backendOnline: boolean | null;
  isStartingOllama?: boolean;
  onStartOllama?: () => void;
  onOpenUpload: () => void;
  reviewCount: number;
}

export const CoinRackViewer: React.FC<CoinRackViewerProps> = ({
  currentTab,
  onSelectTab,
  removedCoins,
  onRestoreCoins,
  ollamaStatus,
  backendOnline,
  isStartingOllama = false,
  onStartOllama,
  onOpenUpload,
  reviewCount
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Discrete React state for UI overlays ONLY
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [activeUiIndex, setActiveUiIndex] = useState(() => {
    const idx = COIN_FEATURES.findIndex(f => f.id === currentTab);
    return idx !== -1 ? idx : 0;
  });
  const [activePreset, setActivePreset] = useState<CameraPreset | 'custom'>('cinematic');
  const [currentFps, setCurrentFps] = useState(60);

  // Mutable refs for 60fps animations (Zero React state churn during interaction!)
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

  // Pointer & Raycasting state in REFS
  const pointerNormRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const isPointerInsideRef = useRef(false);
  const hoveredCoinIndexRef = useRef<number | null>(null);

  // Coin selection & pickup animation state
  const pickingUpIdRef = useRef<string | null>(null);
  const pickingUpProgressRef = useRef(0);

  // Camera presets animation state in REFS
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetCamLookRef = useRef<THREE.Vector3 | null>(null);
  const isTransitioningCameraRef = useRef(false);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeSpotlightRef = useRef<THREE.PointLight | null>(null);

  // Array of coin items with direct mesh handles and per-coin smooth hover progress
  const coinItemsRef = useRef<Array<{
    group: THREE.Group;
    coinMesh: THREE.Mesh;
    hitProxy: THREE.Mesh;
    haloMesh: THREE.Mesh;
    emptyGlowMesh: THREE.Mesh;
    feature: CoinFeature;
    index: number;
    baseX: number;
    hoverProgress: number; // Continuous 0.0 to 1.0 hover state for jitter-free easing
    colorObj: THREE.Color;
  }>>([]);

  // Sync target pos if currentTab changes externally
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

  // Camera preset activator with frame-rate independent interpolation
  const activatePreset = useCallback((presetId: CameraPreset) => {
    const preset = CAMERA_PRESETS.find(p => p.id === presetId);
    if (!preset || !cameraRef.current || !controlsRef.current) return;

    setActivePreset(presetId);
    targetCamPosRef.current = preset.position.clone();
    targetCamLookRef.current = preset.target.clone();
    isTransitioningCameraRef.current = true;
  }, []);

  // Reset camera view to default cinematic
  const resetCamera = useCallback(() => {
    activatePreset('cinematic');
  }, [activatePreset]);

  // Focus camera directly onto a specific coin (e.g. double-click)
  const focusCoinCamera = useCallback((coinIndex: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const posX = START_X + coinIndex * SPACING;
    const targetLook = new THREE.Vector3(posX, 0.9, 0);
    const targetPos = new THREE.Vector3(posX - 0.5, 2.0, 5.2);

    targetCamPosRef.current = targetPos;
    targetCamLookRef.current = targetLook;
    isTransitioningCameraRef.current = true;
    setActivePreset('custom');
  }, [SPACING, START_X]);

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
      } else if (e.key === '1') {
        activatePreset('cinematic');
      } else if (e.key === '2') {
        activatePreset('front');
      } else if (e.key === '3') {
        activatePreset('top');
      } else if (e.key === '4') {
        activatePreset('isometric');
      } else if (e.key === 'r' && !e.altKey) {
        resetCamera();
      } else if (e.key === 'r' && e.altKey) {
        onRestoreCoins();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [TOTAL_COINS, activatePreset, onRestoreCoins, resetCamera, triggerCoinSelection]);

  // Front face canvas texture with full Mipmap generation to eliminate shimmering & aliasing
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

    // Primary Name
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
    // Mipmapping and linear filtering to eliminate edge shimmering!
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // Back face canvas texture with full Mipmap generation
  const createCoinBackFaceTexture = useCallback((feature: CoinFeature): THREE.CanvasTexture => {
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

    // Decorative dashed ring
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(256, 256, 204, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radial metallic sheen
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 224);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 222, 0, Math.PI * 2);
    ctx.fill();

    // Center LedgerLens Emblem
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Diamond Logo
    ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = feature.color;
    ctx.fillText('◈', 256, 175);

    // Brand Name
    ctx.font = 'bold 36px "Plus Jakarta Sans", -apple-system, sans-serif';
    ctx.fillStyle = feature.textColor;
    ctx.fillText('LEDGERLENS', 256, 240);

    // Subtext
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('PRIVATE AI ENGINE', 256, 288);

    // Feature Token Tag
    ctx.font = '600 15px monospace';
    ctx.fillStyle = feature.color;
    ctx.fillText(`TOKEN #${feature.id.toUpperCase()}`, 256, 332);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // Shared knurled rim bump texture with smoothed contrast to prevent normal-sampling jitter
  const sharedReededBump = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 32);

    // Softened ridge transitions to prevent binary pixel moiré jitter
    for (let x = 0; x < 512; x += 4) {
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(x, 0, 2, 32);
      ctx.fillStyle = '#505050';
      ctx.fillRect(x + 2, 0, 2, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(16, 1);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }, []);

  // =========================================================================
  // MASTER THREE.JS LIFECYCLE (MOUNTED ONCE)
  // =========================================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x050611, 0.014);

    // 2. Camera: Extended far plane (120.0) so skybox and distant stars never clip on zoom-out
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.2, 120.0);
    camera.position.set(-2.0, 3.2, 9.2);
    camera.lookAt(0, 0.75, -0.4);
    cameraRef.current = camera;

    // 3. WebGL Renderer with performance-capped DPR and stable depth buffer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false
    });
    const targetPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setSize(width, height);
    renderer.setPixelRatio(targetPixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Set maximum anisotropic filtering on textures if supported
    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, 8);
    sharedReededBump.anisotropy = maxAnisotropy;

    // 4. OrbitControls: Full 360° Interactive Camera System
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 3.5;
    controls.maxDistance = 25.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minPolarAngle = 0.08;
    controls.target.set(0, 0.75, 0);
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    controls.addEventListener('start', () => {
      isTransitioningCameraRef.current = false;
      setActivePreset('custom');
    });

    controlsRef.current = controls;

    // 5. Complete 360° Lighting with NormalBias (Eliminates shadow edge-shuttering!)
    const ambientLight = new THREE.AmbientLight(0x0b1714, 2.2);
    scene.add(ambientLight);

    // Front Key Light
    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    mainKeyLight.position.set(6, 14, 9);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.camera.near = 0.5;
    mainKeyLight.shadow.camera.far = 30;
    // normalBias prevents shadow-acne on curved coin rims!
    mainKeyLight.shadow.bias = -0.0002;
    mainKeyLight.shadow.normalBias = 0.02;
    scene.add(mainKeyLight);

    // Teal Front-Left Backlight
    const tealBackLight = new THREE.DirectionalLight(0x00d6a0, 2.6);
    tealBackLight.position.set(-12, 5, -8);
    scene.add(tealBackLight);

    // Violet Front-Right Fill Light
    const violetFillLight = new THREE.DirectionalLight(0xb45bff, 2.0);
    violetFillLight.position.set(10, -3, 6);
    scene.add(violetFillLight);

    // Rear Specular Key Light with normalBias
    const rearKeyLight = new THREE.DirectionalLight(0x7090b0, 2.2);
    rearKeyLight.position.set(0, 10, -12);
    rearKeyLight.castShadow = true;
    rearKeyLight.shadow.mapSize.width = 1024;
    rearKeyLight.shadow.mapSize.height = 1024;
    rearKeyLight.shadow.bias = -0.0002;
    rearKeyLight.shadow.normalBias = 0.02;
    scene.add(rearKeyLight);

    // Dynamic spotlight tracking focused coin
    const activeSpotlight = new THREE.PointLight(0x00d6a0, 4.2, 7, 1.2);
    activeSpotlight.position.set(0, 1.5, 1.2);
    scene.add(activeSpotlight);
    activeSpotlightRef.current = activeSpotlight;

    // 5.5 Cosmic Nebula Skybox & Starburst Field (Camera-centered skybox group so zooming/panning never clips)
    const skyboxGroup = new THREE.Group();
    skyboxGroup.position.copy(camera.position);
    scene.add(skyboxGroup);

    const nebulaUniforms = {
      uTime: { value: 0 },
      uFocusX: { value: 0 }
    };

    const nebulaGeo = new THREE.SphereGeometry(50, 40, 40);
    const nebulaMat = new THREE.ShaderMaterial({
      uniforms: nebulaUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(mat3(modelMatrix) * position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = p * 2.03 + vec3(0.13, -0.17, 0.21);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vWorldDir);
          float t = uTime * 0.035;

          // Diagonal galactic plane coordinate matching reference image
          float diagBand = exp(-pow((d.y - d.x * 0.65) * 1.75, 2.0));

          // Upward-drifting domain-warped FBM clouds ("up effect" flow)
          vec3 flowOffset = vec3(-uTime * 0.018, -uTime * 0.055, 0.0);
          vec3 q = vec3(
            fbm(d * 2.4 + flowOffset + vec3(t, -t * 0.6, 0.0)),
            fbm(d * 2.4 + flowOffset + vec3(1.4, 2.9, -t * 0.5)),
            fbm(d * 2.4 + flowOffset + vec3(-2.1, t * 0.4, 1.7))
          );
          float cloud = fbm(d * 3.0 + q * 1.45 + flowOffset * 1.3);
          float wisps = smoothstep(0.26, 0.78, cloud) * (0.42 + 0.75 * diagBand);

          // Deep cosmic base
          vec3 col = vec3(0.010, 0.012, 0.028);

          // Lower-left celestial blue/indigo nebula
          float blueMask = smoothstep(-0.65, 0.55, -d.x * 0.5 - d.y * 0.35 + (q.x - 0.45));
          vec3 blueNebula = mix(vec3(0.08, 0.18, 0.42), vec3(0.28, 0.52, 0.90), cloud);
          col += blueNebula * wisps * blueMask * 1.15;

          // Upper-right magenta/rose/violet nebula
          float pinkMask = smoothstep(-0.45, 0.65, d.x * 0.55 + d.y * 0.45 + (q.y - 0.45));
          vec3 pinkNebula = mix(vec3(0.36, 0.11, 0.38), vec3(0.82, 0.36, 0.62), cloud);
          col += pinkNebula * wisps * pinkMask * 1.15;

          // Warm amber/gold stellar dust core highlights
          float coreDust = pow(max(0.0, cloud * diagBand), 2.6);
          col += vec3(0.90, 0.56, 0.38) * coreDust * 0.55;

          // Dark dust lane filament contrast
          float darkLane = smoothstep(0.45, 0.68, fbm(d * 4.5 - q * 0.8));
          col *= mix(1.0, 0.52, darkLane * diagBand * 0.65);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    nebulaMesh.renderOrder = -20;
    nebulaMesh.frustumCulled = false;
    skyboxGroup.add(nebulaMesh);

    // Multi-layered Starfield with Twinkle & Diffraction Spikes
    const particleCount = 1450;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleSeeds = new Float32Array(particleCount);

    const starPalette = [
      new THREE.Color(0xffffff), // Pure white
      new THREE.Color(0xa8ccff), // Celestial blue-white
      new THREE.Color(0x74a8ff), // Deep sapphire blue
      new THREE.Color(0xffcfa0), // Warm gold/amber
      new THREE.Color(0xffa8d8)  // Nebula rose-pink
    ];

    for (let i = 0; i < particleCount; i++) {
      // Concentrate 55% of stars along the diagonal nebula band, 45% all-sky
      const inBand = i < particleCount * 0.55;
      const radius = 26 + Math.random() * 20;
      let u = (Math.random() - 0.5) * 2;
      let v = (Math.random() - 0.5) * 2;
      let w = (Math.random() - 0.5) * 2;
      if (inBand) {
        // Bias toward y ~= x * 0.65 diagonal plane
        v = u * 0.65 + (Math.random() - 0.5) * 0.65;
      }
      const len = Math.hypot(u, v, w) || 1;
      particlePositions[i * 3] = (u / len) * radius;
      particlePositions[i * 3 + 1] = (v / len) * radius;
      particlePositions[i * 3 + 2] = (w / len) * radius;

      const c = starPalette[Math.floor(Math.random() * starPalette.length)];
      particleColors[i * 3] = c.r;
      particleColors[i * 3 + 1] = c.g;
      particleColors[i * 3 + 2] = c.b;

      // Occasional hero diffraction flare stars (like the reference image)
      const isHeroStar = i < 32;
      particleSizes[i] = isHeroStar ? (28.0 + Math.random() * 22.0) : (3.5 + Math.pow(Math.random(), 2.4) * 12.0);
      particleSeeds[i] = Math.random() * 100.0;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('aColor', new THREE.BufferAttribute(particleColors, 3));
    particleGeo.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));
    particleGeo.setAttribute('aSeed', new THREE.BufferAttribute(particleSeeds, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: nebulaUniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aSeed;
        uniform float uTime;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;

        void main() {
          vColor = aColor;
          vIsHero = step(22.0, aSize);
          float speed = 1.4 + mod(aSeed, 3.2);
          vTwinkle = 0.65 + 0.35 * sin(uTime * speed + aSeed * 6.2831);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * vTwinkle * (22.0 / max(1.0, -mvPosition.z));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;

          // Soft radial star core
          float core = exp(-d * d * 28.0);
          float halo = smoothstep(0.5, 0.0, d) * 0.35;
          float brightness = core + halo;

          // 4-point + diagonal diffraction spikes on bright hero stars
          if (vIsHero > 0.5) {
            float spikeH = exp(-abs(uv.y) * 36.0) * smoothstep(0.5, 0.0, abs(uv.x));
            float spikeV = exp(-abs(uv.x) * 36.0) * smoothstep(0.5, 0.0, abs(uv.y));
            vec2 rotUv = vec2(uv.x + uv.y, uv.x - uv.y) * 0.7071;
            float spikeD = (exp(-abs(rotUv.y) * 48.0) + exp(-abs(rotUv.x) * 48.0)) * smoothstep(0.35, 0.0, d) * 0.45;
            brightness += (spikeH + spikeV) * 0.85 + spikeD;
          }

          vec3 finalColor = mix(vColor, vec3(1.0), clamp(core * 0.75, 0.0, 1.0));
          gl_FragColor = vec4(finalColor, clamp(brightness * vTwinkle, 0.0, 1.0));
        }
      `
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particles.renderOrder = -19;
    particles.frustumCulled = false;
    skyboxGroup.add(particles);

    // 5.6 Sparse, Delicate Shooting-Star Motion Streaks (Cinematic falling sense of depth, not dense rain)
    const upStreakCount = 16;
    const upStreakBaseGeo = new THREE.PlaneGeometry(0.022, 1.8);
    const upStreakMat = new THREE.ShaderMaterial({
      uniforms: nebulaUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aOffset;
        attribute vec3 aStreakColor;
        attribute vec2 aParams; // x: speed, y: phase
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vUv = uv;
          vColor = aStreakColor;

          float speed = aParams.x;
          float phase = aParams.y;
          float cycle = fract(uTime * speed + phase);

          // Only visible for a brief window in its cycle so only a few delicate streaks appear at once
          vAlpha = smoothstep(0.15, 0.35, cycle) * smoothstep(0.85, 0.55, cycle) * 0.45;

          vec3 pos = position;
          pos.y *= (0.7 + 0.6 * fract(phase * 7.3));

          // Diagonal orientation matching the Pinterest astronaut falling perspective
          float tiltAngle = -0.62;
          float c = cos(tiltAngle);
          float s = sin(tiltAngle);
          vec2 rotatedXY = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          pos.x = rotatedXY.x;
          pos.y = rotatedXY.y;

          float travel = 9.0;
          vec3 worldOffset = aOffset;
          worldOffset.y += (cycle - 0.5) * travel;
          worldOffset.x += (cycle - 0.5) * travel * 0.72;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + worldOffset, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float horiz = exp(-pow((vUv.x - 0.5) * 9.0, 2.0));
          float vert = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          float intensity = horiz * vert * vAlpha;
          if (intensity < 0.005) discard;

          gl_FragColor = vec4(vColor, clamp(intensity, 0.0, 1.0));
        }
      `
    });

    const upStreakGeo = new THREE.InstancedBufferGeometry();
    upStreakGeo.index = upStreakBaseGeo.index;
    upStreakGeo.attributes.position = upStreakBaseGeo.attributes.position;
    upStreakGeo.attributes.uv = upStreakBaseGeo.attributes.uv;

    const streakOffsets = new Float32Array(upStreakCount * 3);
    const streakColors = new Float32Array(upStreakCount * 3);
    const streakParams = new Float32Array(upStreakCount * 2);

    for (let i = 0; i < upStreakCount; i++) {
      streakOffsets[i * 3] = (Math.random() - 0.5) * 28.0;
      streakOffsets[i * 3 + 1] = -3.5 + (Math.random() - 0.5) * 9.0;
      streakOffsets[i * 3 + 2] = -3.5 - Math.random() * 10.0;

      const isBlue = i % 2 === 0;
      streakColors[i * 3] = isBlue ? 0.72 : 1.0;
      streakColors[i * 3 + 1] = isBlue ? 0.88 : 1.0;
      streakColors[i * 3 + 2] = 1.0;

      streakParams[i * 2] = 0.045 + Math.random() * 0.05;
      streakParams[i * 2 + 1] = i / upStreakCount + Math.random() * 0.05;
    }

    upStreakGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(streakOffsets, 3));
    upStreakGeo.setAttribute('aStreakColor', new THREE.InstancedBufferAttribute(streakColors, 3));
    upStreakGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(streakParams, 2));

    const upStreaksMesh = new THREE.Mesh(upStreakGeo, upStreakMat);
    upStreaksMesh.frustumCulled = false;
    scene.add(upStreaksMesh);

    // 5.7 Photoreal NASA EVA Astronaut falling off the coin platform (public-domain NASA 3D Resources GLB)
    // Root lives inside coinsGroup so the astronaut stands on, and falls from, the actual rack surface.
    const astronautRoot = new THREE.Group();
    // (attached to coinsGroup once the conveyor group is created below)

    // Inner pivot so we can tumble the body independently of the fall trajectory
    const astronautBody = new THREE.Group();
    astronautRoot.add(astronautBody);

    // Soft Stellar Backlight & Horizontal Anamorphic Lens Flare behind the falling astronaut
    const astroFlareGeo = new THREE.PlaneGeometry(9.0, 3.6);
    const astroFlareMat = new THREE.ShaderMaterial({
      uniforms: nebulaUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv - vec2(0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float d = length(vUv * vec2(1.8, 1.0));
          float pulse = 0.92 + 0.08 * sin(uTime * 1.8);
          float core = exp(-d * d * 60.0) * pulse;
          float warmGlow = exp(-d * 7.5) * 0.22;
          float blueNebulaHalo = exp(-d * 3.6) * 0.14;
          float hStreak = exp(-abs(vUv.y) * 60.0) * exp(-abs(vUv.x) * 4.5) * pulse;
          vec3 col = vec3(0.18, 0.46, 0.95) * blueNebulaHalo;
          col += vec3(1.0, 0.72, 0.38) * warmGlow;
          col += vec3(0.58, 0.86, 1.0) * hStreak * 0.4;
          col += vec3(1.0, 0.98, 0.92) * core * 0.45;
          float alpha = clamp(core * 0.6 + warmGlow * 0.6 + blueNebulaHalo * 0.55 + hStreak * 0.35, 0.0, 0.55);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    const astroFlareMesh = new THREE.Mesh(astroFlareGeo, astroFlareMat);
    astroFlareMesh.position.set(0.0, 0.9, -2.4);
    astronautRoot.add(astroFlareMesh);

    // Key + cool rim. Kept moderate so the suit's red bands, flags, and gold visor are not blown to white.
    const astroKeyLight = new THREE.SpotLight(0xfff4e6, 5.4, 14.0, 0.75, 0.6, 1.3);
    astroKeyLight.position.set(2.2, 3.4, 3.0);
    astroKeyLight.castShadow = false;
    astronautRoot.add(astroKeyLight);
    astroKeyLight.target = astronautBody;

    const astroRimLight = new THREE.PointLight(0x9ecbff, 3.2, 9.0, 1.6);
    astroRimLight.position.set(-1.6, 1.8, -1.4);
    astronautRoot.add(astroRimLight);

    // Photoreal PBR environment reflections (applied ONLY to the astronaut materials, coins keep their look)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const astroEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const astroGeometries: THREE.BufferGeometry[] = [astroFlareGeo];
    const astroMaterials: THREE.Material[] = [];
    // Recolored EMU albedo: cool beta-cloth, thickened red leg bands, saturated flag and NASA patches.
    const astroSuitMap = new THREE.TextureLoader().load('/models/astronaut-suit.png');
    astroSuitMap.flipY = false;
    astroSuitMap.colorSpace = THREE.SRGBColorSpace;
    astroSuitMap.anisotropy = 4;
    let astronautModel: THREE.Object3D | null = null;
    let astronautLoaderDisposed = false;
    let astroCycleStart = 0; // Cycle begins the moment the model finishes loading

    const astroShadowSuitHeight = 1.75; // World-unit height of the normalized astronaut

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.load(
      '/models/astronaut.glb',
      (gltf) => {
        if (astronautLoaderDisposed) {
          gltf.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.geometry.dispose();
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m.dispose());
            }
          });
          return;
        }

        const model = gltf.scene;

        // Normalize scale: fit height to astroShadowSuitHeight and place feet at local y = 0
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const normScale = astroShadowSuitHeight / Math.max(size.y, 0.0001);
        model.scale.setScalar(normScale);

        const bbox2 = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        bbox2.getCenter(center);
        model.position.set(-center.x, -bbox2.min.y, -center.z);
        model.updateMatrixWorld(true);

        const modelBox = new THREE.Box3().setFromObject(model);
        const modelHeight = Math.max(modelBox.max.y - modelBox.min.y, 0.0001);
        const modelHalfW = Math.max((modelBox.max.x - modelBox.min.x) * 0.5, 0.0001);
        const modelCenterX = (modelBox.min.x + modelBox.max.x) * 0.5;
        const astroVert = new THREE.Vector3();
        const astroNormal = new THREE.Vector3();
        const astroNormalMatrix = new THREE.Matrix3();

        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const sourceGeo = mesh.geometry;
          const geo = sourceGeo.clone();
          mesh.geometry = geo;
          astroGeometries.push(geo);
          sourceGeo.dispose();

          const meshBox = new THREE.Box3().setFromObject(mesh);
          const meshMidY = (meshBox.min.y + meshBox.max.y) * 0.5;
          const meshHeight = meshBox.max.y - meshBox.min.y;
          const isVisor = meshHeight < modelHeight * 0.4
            && (meshMidY - modelBox.min.y) / modelHeight > 0.72;

          // Limb bands and the gold visor are painted in vertex colors so they sit on the
          // body itself. The albedo's red stripe faces away from the camera.
          const position = geo.attributes.position;
          const normal = geo.attributes.normal;
          const colors = new Float32Array(position.count * 3);
          astroNormalMatrix.getNormalMatrix(mesh.matrixWorld);
          for (let i = 0; i < position.count; i++) {
            astroVert.fromBufferAttribute(position as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
            const t = (astroVert.y - modelBox.min.y) / modelHeight;
            const dx = Math.abs(astroVert.x - modelCenterX) / modelHalfW;
            let r = 1, g = 1, b = 1;
            if (normal) {
              astroNormal.fromBufferAttribute(normal as THREE.BufferAttribute, i).applyMatrix3(astroNormalMatrix).normalize();
              if (t > 0.80 && astroNormal.z > 0.25) {
                r = 1.0; g = 0.68; b = 0.22;
              }
            }
            const legBand = t > 0.14 && t < 0.30 && dx > 0.18;
            const armBand = t > 0.55 && t < 0.72 && dx > 0.42;
            if (legBand || armBand) {
              r = 0.72; g = 0.06; b = 0.08;
            }
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            if ((std as any).isMeshStandardMaterial) {
              std.envMap = astroEnvTexture;
              std.vertexColors = true;
              if (isVisor) {
                // Gold-coated sun visor: reflective, so the nebula reads in the glass
                if (std.map) std.map.dispose();
                std.map = null;
                std.color.set(0xf0c14a);
                std.metalness = 0.94;
                std.roughness = 0.14;
                std.envMapIntensity = 1.55;
              } else {
                if (std.map) std.map.dispose();
                std.map = astroSuitMap;
                std.color.set(0xffffff);
                std.metalness = 0.04;
                std.roughness = 0.62;
                std.envMapIntensity = 0.32;
              }
              std.needsUpdate = true;
            }
            m.transparent = false;
            m.opacity = 1.0;
            astroMaterials.push(m);
          });
        });

        astronautBody.add(model);
        astronautModel = model;
        astroCycleStart = clock.getElapsedTime();
      },
      undefined,
      (err) => {
        console.error('Failed to load astronaut model:', err);
      }
    );

    // Fall-from-platform choreography constants (rack top surface sits at local y ≈ -0.175)
    const RACK_TOP_Y = -0.175;
    const RACK_FRONT_Z = 1.22;
    const ASTRO_CYCLE = 16.0;         // Full loop duration (seconds)
    const ASTRO_STAND_END = 3.2;      // Standing at the platform edge, swaying
    const ASTRO_TIP_END = 4.6;        // Losing balance & tipping over the edge
    const ASTRO_FALL_END = 14.0;      // Slow-motion weightless tumble into deep space
    const astroEuler = new THREE.Euler();
    const astroFlareWorldPos = new THREE.Vector3();
    const astroCamWorldPos = new THREE.Vector3();
    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const setAstronautOpacity = (o: number) => {
      const needsBlend = o < 0.995;
      for (let i = 0; i < astroMaterials.length; i++) {
        const m = astroMaterials[i];
        m.opacity = o;
        if (m.transparent !== needsBlend) {
          m.transparent = needsBlend;
          m.needsUpdate = true;
        }
      }
      astronautBody.visible = o > 0.01;
      astroFlareMesh.visible = o > 0.02;
    };

    // 6. Shared Geometries (64 radial segments for ultra-smooth silhouette rim)
    const coinGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.25, 64);
    const pedestalGeo = new THREE.BoxGeometry(1.6, 0.86, 2.1);
    const grooveGeo = new THREE.BoxGeometry(0.38, 0.30, 1.7);
    const ledGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24);
    ledGeo.rotateX(Math.PI / 2);
    const streakGeo = new THREE.PlaneGeometry(0.48, 0.7);
    const emptyGlowGeo = new THREE.RingGeometry(0.2, 0.7, 24);
    const haloGeo = new THREE.PlaneGeometry(1.5, 1.5);

    // Stationary invisible Hit-Proxy Geometry for stable, jitter-free raycasting
    const hitProxyGeo = new THREE.CylinderGeometry(1.28, 1.28, 0.45, 24);
    hitProxyGeo.rotateX(Math.PI / 2);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });

    // Shared materials with polygonOffset on groove to eliminate coplanar Z-fighting
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0b1714,
      metalness: 0.7,
      roughness: 0.3
    });
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x030706,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    // 7. Conveyor Group
    const coinsGroup = new THREE.Group();
    coinsGroup.rotation.y = 0.26;
    coinsGroup.rotation.x = 0.035;
    scene.add(coinsGroup);
    coinsGroup.add(astronautRoot);

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

    // Front edge neon wire (teal)
    const edgeNeonGeo = new THREE.BoxGeometry(TOTAL_WIDTH + 8, 0.05, 0.05);
    const edgeNeonMat = new THREE.MeshBasicMaterial({ color: 0x00d6a0 });
    const edgeNeonMesh = new THREE.Mesh(edgeNeonGeo, edgeNeonMat);
    edgeNeonMesh.position.set(0, -0.16, 1.4);
    coinsGroup.add(edgeNeonMesh);

    // Rear edge neon wire (electric violet)
    const rearNeonMat = new THREE.MeshBasicMaterial({ color: 0xb45bff });
    const rearNeonMesh = new THREE.Mesh(edgeNeonGeo, rearNeonMat);
    rearNeonMesh.position.set(0, -0.16, -1.4);
    coinsGroup.add(rearNeonMesh);

    // Build the 10 slots & coins
    const items: Array<{
      group: THREE.Group;
      coinMesh: THREE.Mesh;
      hitProxy: THREE.Mesh;
      haloMesh: THREE.Mesh;
      emptyGlowMesh: THREE.Mesh;
      feature: CoinFeature;
      index: number;
      baseX: number;
      hoverProgress: number;
      colorObj: THREE.Color;
    }> = [];

    // Track all per-coin textures and materials for complete GPU disposal on unmount
    const disposableTextures: THREE.Texture[] = [];
    const disposableMaterials: THREE.Material[] = [
      nebulaMat,
      particleMat,
      upStreakMat,
      astroFlareMat,
      pedestalMat,
      grooveMat,
      hitProxyMat,
      rackBaseMat,
      edgeNeonMat,
      rearNeonMat
    ];

    // Stationary proxies for raycasting (prevents animation feedback loop!)
    const interactiveHitProxies: THREE.Mesh[] = [];

    COIN_FEATURES.forEach((feature, idx) => {
      const posX = START_X + idx * SPACING;

      // Pedestal Block
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(posX, -0.15, 0);

      const blockMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
      blockMesh.receiveShadow = true;
      pedestalGroup.add(blockMesh);

      // Slot groove with distinct depth
      const grooveMesh = new THREE.Mesh(grooveGeo, grooveMat);
      grooveMesh.position.set(0, 0.36, 0);
      pedestalGroup.add(grooveMesh);

      // Front LED indicator
      const ledMat = new THREE.MeshBasicMaterial({ color: feature.ledColor });
      disposableMaterials.push(ledMat);
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0, -0.08, 1.06);
      pedestalGroup.add(ledMesh);

      // Rear LED indicator (visible when orbiting behind)
      const rearLedMesh = new THREE.Mesh(ledGeo, ledMat);
      rearLedMesh.position.set(0, -0.08, -1.06);
      pedestalGroup.add(rearLedMesh);

      // Vertical light streak (depthWrite: false to prevent sorting artifacts)
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
      streakTex.generateMipmaps = true;
      streakTex.minFilter = THREE.LinearMipmapLinearFilter;
      disposableTextures.push(streakTex);
      const streakMat = new THREE.MeshBasicMaterial({
        map: streakTex,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      disposableMaterials.push(streakMat);
      const streakMesh = new THREE.Mesh(streakGeo, streakMat);
      streakMesh.position.set(0, -0.5, 1.06);
      pedestalGroup.add(streakMesh);

      // Ghostly empty slot glow indicator (depthWrite: false)
      const emptyGlowMat = new THREE.MeshBasicMaterial({
        color: feature.color,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      disposableMaterials.push(emptyGlowMat);
      const emptyGlowMesh = new THREE.Mesh(emptyGlowGeo, emptyGlowMat);
      emptyGlowMesh.rotation.x = -Math.PI / 2;
      emptyGlowMesh.position.set(0, 0.42, 0);
      pedestalGroup.add(emptyGlowMesh);

      coinsGroup.add(pedestalGroup);

      // Stationary invisible Hit Proxy Collider (STATIONARY IN SLOT - ZERO BOUNCING!)
      const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      hitProxy.position.set(posX, 0.9, 0);
      hitProxy.userData = { feature, index: idx };
      coinsGroup.add(hitProxy);
      interactiveHitProxies.push(hitProxy);

      // 3D Coin Mesh Group
      const coinGroup = new THREE.Group();
      coinGroup.position.set(posX, 0.7, 0);

      const frontFaceTex = createCoinFaceTexture(feature);
      const backFaceTex = createCoinBackFaceTexture(feature);
      frontFaceTex.anisotropy = maxAnisotropy;
      backFaceTex.anisotropy = maxAnisotropy;
      disposableTextures.push(frontFaceTex, backFaceTex);

      const coinColorObj = new THREE.Color(feature.color);

      // Fluted edge material: controlled bumpScale (0.025) and roughness (0.24) eliminates edge sparkle!
      const edgeMat = new THREE.MeshStandardMaterial({
        color: coinColorObj,
        metalness: 0.88,
        roughness: 0.24,
        bumpMap: sharedReededBump,
        bumpScale: 0.025
      });

      // Front face material
      const frontFaceMat = new THREE.MeshStandardMaterial({
        map: frontFaceTex,
        metalness: 0.45,
        roughness: 0.32,
        depthTest: true,
        depthWrite: true
      });

      // Back face material
      const backFaceMat = new THREE.MeshStandardMaterial({
        map: backFaceTex,
        metalness: 0.48,
        roughness: 0.30,
        depthTest: true,
        depthWrite: true
      });
      disposableMaterials.push(edgeMat, frontFaceMat, backFaceMat);

      // CylinderGeometry: [0]: side rim, [1]: top/front cap, [2]: bottom/back cap
      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, frontFaceMat, backFaceMat]);
      coinMesh.rotation.x = Math.PI / 2; // Upright
      coinMesh.castShadow = true;
      coinMesh.receiveShadow = true;
      coinMesh.userData = { feature, index: idx };

      coinGroup.add(coinMesh);

      // Upward spotlight halo underneath coin (depthWrite: false eliminates Z-sorting pop!)
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
      haloTex.generateMipmaps = true;
      haloTex.minFilter = THREE.LinearMipmapLinearFilter;
      disposableTextures.push(haloTex);
      const haloMat = new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      disposableMaterials.push(haloMat);
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      haloMesh.position.y = -0.58;
      coinGroup.add(haloMesh);

      coinsGroup.add(coinGroup);

      items.push({
        group: coinGroup,
        coinMesh,
        hitProxy,
        haloMesh,
        emptyGlowMesh,
        feature,
        index: idx,
        baseX: posX,
        hoverProgress: 0.0,
        colorObj: coinColorObj
      });
    });

    coinItemsRef.current = items;

    // 8. Raycaster & Pointer Interaction with Strict Click-vs-Drag Discrimination
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const dom = renderer.domElement;

    // Track click vs drag parameters
    let pointerDownTime = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownHitCoin: CoinFeature | null = null;
    let pointerDownHitIndex: number | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownTime = performance.now();
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;

      const rect = dom.getBoundingClientRect();
      mouseVector.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(interactiveHitProxies, false);
      if (intersects.length > 0) {
        pointerDownHitCoin = intersects[0].object.userData.feature as CoinFeature;
        pointerDownHitIndex = intersects[0].object.userData.index as number;
      } else {
        pointerDownHitCoin = null;
        pointerDownHitIndex = null;
      }
    };

    let pointerDirty = false;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerNormRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNormRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      isPointerInsideRef.current = true;
      pointerDirty = true;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      const duration = performance.now() - pointerDownTime;

      // Strict Click Discrimination: movement must be under 6 pixels and under 500ms
      if (dist < 6 && duration < 500 && pointerDownHitCoin) {
        if (!removedCoinsRef.current.has(pointerDownHitCoin.id)) {
          triggerCoinSelection(pointerDownHitCoin.id);
        }
      }
      pointerDownHitCoin = null;
      pointerDownHitIndex = null;
    };

    // Double-click: focus camera on clicked coin!
    const handleDblClick = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      mouseVector.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(interactiveHitProxies, false);
      if (intersects.length > 0) {
        const hitIdx = intersects[0].object.userData.index as number;
        focusCoinCamera(hitIdx);
        targetPosRef.current = hitIdx;
      }
    };

    const handlePointerLeave = () => {
      isPointerInsideRef.current = false;
      hoveredCoinIndexRef.current = null;
      dom.style.cursor = 'default';
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('dblclick', handleDblClick);
    dom.addEventListener('pointerleave', handlePointerLeave);

    // =========================================================================
    // 9. MASTER ANIMATION LOOP (LOCKED 60 FPS, JITTER-FREE DAMPING)
    // =========================================================================
    let clock = new THREE.Clock();
    let frameCounter = 0;
    let fpsTimeAccum = 0;
    let lastUiSyncPos = -1;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // FPS Monitoring
      frameCounter++;
      fpsTimeAccum += delta;
      if (fpsTimeAccum >= 1.0) {
        const measuredFps = Math.round(frameCounter / fpsTimeAccum);
        setCurrentFps(measuredFps);
        frameCounter = 0;
        fpsTimeAccum = 0;

        if (measuredFps < 48 && renderer.getPixelRatio() > 1.0) {
          renderer.setPixelRatio(1.0);
        } else if (measuredFps > 58 && renderer.getPixelRatio() < targetPixelRatio) {
          renderer.setPixelRatio(targetPixelRatio);
        }
      }

      // --- 1. Camera Preset Interpolation ---
      if (isTransitioningCameraRef.current && targetCamPosRef.current && targetCamLookRef.current) {
        const camLerpAlpha = 1.0 - Math.exp(-8.0 * delta);
        camera.position.lerp(targetCamPosRef.current, camLerpAlpha);
        controls.target.lerp(targetCamLookRef.current, camLerpAlpha);

        if (
          camera.position.distanceTo(targetCamPosRef.current) < 0.05 &&
          controls.target.distanceTo(targetCamLookRef.current) < 0.05
        ) {
          camera.position.copy(targetCamPosRef.current);
          controls.target.copy(targetCamLookRef.current);
          isTransitioningCameraRef.current = false;
        }
      }

      // Update OrbitControls
      const controlsMoved = controls.update();

      // --- 2. Conveyor Smooth Damping ---
      const targetPos = targetPosRef.current;
      const alpha = 1.0 - Math.exp(-12.0 * delta);
      currentPosRef.current += (targetPos - currentPosRef.current) * alpha;

      const currentPos = currentPosRef.current;

      // Sync active discrete index to React UI card only when rounded integer actually changes!
      const roundedIndex = Math.max(0, Math.min(TOTAL_COINS - 1, Math.round(currentPos)));
      if (roundedIndex !== lastUiSyncPos) {
        lastUiSyncPos = roundedIndex;
        setActiveUiIndex(roundedIndex);
      }

      // --- 3. Dynamic Spotlight Tracking (Zero per-frame Color allocation) ---
      const focusX = START_X + currentPos * SPACING;
      nebulaUniforms.uFocusX.value = focusX;
      if (activeSpotlightRef.current) {
        const activeColor = items[roundedIndex]?.colorObj;
        if (activeColor) {
          activeSpotlightRef.current.color.lerp(activeColor, 0.15);
        }
        activeSpotlightRef.current.position.x += (focusX - activeSpotlightRef.current.position.x) * (1.0 - Math.exp(-14.0 * delta));
      }

      // --- 4. Cosmic Nebula, Starfield & Falling Astronaut Animation ---
      skyboxGroup.position.copy(camera.position);
      if (isPlayingRef.current) {
        nebulaUniforms.uTime.value = elapsedTime;
        particles.rotation.y = elapsedTime * 0.012;
        particles.rotation.z = Math.sin(elapsedTime * 0.05) * 0.025;
        nebulaMesh.rotation.y = elapsedTime * 0.008;

        // ===== Astronaut: stands at the platform edge beside the focused coin, tips over, and tumbles into space =====
        const cycleT = astronautModel ? (elapsedTime - astroCycleStart) % ASTRO_CYCLE : -1;
        // Stand one slot to the left of the focused coin, right at the front lip of the rack
        const standX = focusX - SPACING * 0.55;

        if (cycleT < 0) {
          setAstronautOpacity(0.0);
        } else if (cycleT < ASTRO_STAND_END) {
          // Phase A: standing on the platform edge with a gentle, uneasy sway
          const sway = Math.sin(elapsedTime * 1.6) * 0.035;
          astronautRoot.position.set(standX, RACK_TOP_Y, RACK_FRONT_Z);
          astronautBody.position.set(0, 0, 0);
          astronautBody.rotation.set(sway * 0.6, 0.18 + Math.sin(elapsedTime * 0.7) * 0.08, sway);
          setAstronautOpacity(smoothstep(0.0, 0.9, cycleT));
        } else if (cycleT < ASTRO_TIP_END) {
          // Phase B: loses balance, leans and tips forward over the front edge
          const tipT = smoothstep(ASTRO_STAND_END, ASTRO_TIP_END, cycleT);
          const lean = tipT * tipT;
          astronautRoot.position.set(standX, RACK_TOP_Y - lean * 0.25, RACK_FRONT_Z + lean * 0.55);
          astronautBody.position.set(0, 0, 0);
          astronautBody.rotation.set(lean * 0.95, 0.18 + lean * 0.3, -lean * 0.25);
          setAstronautOpacity(1.0);
        } else if (cycleT < ASTRO_FALL_END) {
          // Phase C: slow-motion weightless free-fall & tumble away from the platform into deep space
          const fallSec = cycleT - ASTRO_TIP_END;
          const fallT = fallSec / (ASTRO_FALL_END - ASTRO_TIP_END);
          // Gentle gravity: slow, eased weightless descent that stays within the cinematic frame
          const drop = fallSec * 0.22 + fallSec * fallSec * 0.026;
          const outward = fallSec * 0.24;
          const sideways = fallSec * 0.10 + Math.sin(fallSec * 0.9) * 0.16;
          astronautRoot.position.set(standX + sideways, RACK_TOP_Y - 0.25 - drop, RACK_FRONT_Z + 0.55 + outward);

          // Continuous tumble: pitch over backward (head-first) with a slow roll, like the reference video
          astroEuler.set(
            0.95 + fallSec * 0.62,
            0.48 + Math.sin(fallSec * 0.55) * 0.35,
            -0.25 - fallSec * 0.28
          );
          astronautBody.rotation.copy(astroEuler);
          astronautBody.position.set(0, 0, 0);

          // Fade into the void during the final stretch of the fall
          setAstronautOpacity(1.0 - smoothstep(0.72, 1.0, fallT));
        } else {
          // Phase D: hidden while resetting back to the platform edge
          setAstronautOpacity(0.0);
          astronautRoot.position.set(standX, RACK_TOP_Y, RACK_FRONT_Z);
          astronautBody.rotation.set(0, 0.18, 0);
        }

        // Keep the stellar backlight billboarded toward the camera behind the astronaut's torso
        astroFlareMesh.getWorldPosition(astroFlareWorldPos);
        camera.getWorldPosition(astroCamWorldPos);
        astroFlareMesh.lookAt(astroCamWorldPos);
      }

      // --- 5. Event-Driven Raycasting (Only raycast when pointer or camera moved) ---
      if (isPointerInsideRef.current && (pointerDirty || controlsMoved || isTransitioningCameraRef.current)) {
        pointerDirty = false;
        mouseVector.set(pointerNormRef.current.x, pointerNormRef.current.y);
        raycaster.setFromCamera(mouseVector, camera);
        const intersects = raycaster.intersectObjects(interactiveHitProxies, false);

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

      // --- 6. Transform Every Coin with Per-Coin Continuous Hover Easing ---
      const isPlayingLoop = isPlayingRef.current;
      const pickingUpId = pickingUpIdRef.current;
      const removedCoinsSet = removedCoinsRef.current;

      items.forEach((item) => {
        const { group, haloMesh, emptyGlowMesh, feature, index } = item;
        const isRemoved = removedCoinsSet.has(feature.id);
        const isBeingPickedUp = pickingUpId === feature.id;
        const isHovered = hoveredCoinIndexRef.current === index;

        // Smooth continuous hover easing: 0.0 (resting) to 1.0 (fully elevated)
        const hoverTarget = (isHovered && !isRemoved) ? 1.0 : 0.0;
        item.hoverProgress += (hoverTarget - item.hoverProgress) * (1.0 - Math.exp(-10.0 * delta));

        // Continuous distance from floating conveyor cursor
        const distFromFocus = Math.abs(currentPos - index);
        const proximity = Math.max(0, 1.0 - distFromFocus * 0.8);

        if (isRemoved && !isBeingPickedUp) {
          group.visible = false;
          (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
          return;
        }

        group.visible = true;
        (emptyGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;

        // Elevation calculation: Smoothly incorporates hoverProgress without any abrupt jumps
        let targetY = 0.65;
        if (isBeingPickedUp) {
          pickingUpProgressRef.current = Math.min(1.0, pickingUpProgressRef.current + delta * 2.5);
          targetY = 0.65 + pickingUpProgressRef.current * 2.5;
        } else {
          targetY = 0.65 + proximity * 0.95 + item.hoverProgress * 0.32;
        }

        group.position.y += (targetY - group.position.y) * (1.0 - Math.exp(-14.0 * delta));

        // Subtle idle rhythmic floating
        if (isPlayingLoop && !isBeingPickedUp) {
          const idleWave = Math.sin(elapsedTime * 2.2 + index * 0.5) * 0.035;
          const idleTilt = Math.cos(elapsedTime * 1.8 + index * 0.4) * 0.04;
          group.rotation.y = idleTilt * proximity;
          group.position.y += idleWave * proximity;
        }

        // Camera tilt & scaling based on proximity and smooth hover progress
        let targetRotX = -0.14 * proximity - 0.05 * item.hoverProgress;
        let targetScale = 1.0 + 0.05 * proximity + 0.03 * item.hoverProgress;

        if (isBeingPickedUp) {
          targetRotX = -0.3;
          targetScale = 1.0 + pickingUpProgressRef.current * 0.25;
          group.rotation.y += delta * 6.0;
        }

        group.rotation.x += (targetRotX - group.rotation.x) * (1.0 - Math.exp(-12.0 * delta));
        group.scale.set(targetScale, targetScale, targetScale);

        // Halo opacity underneath (depthWrite: false ensures zero Z-fighting with slot faces)
        if (haloMesh && haloMesh.material instanceof THREE.MeshBasicMaterial) {
          const targetHaloOpacity = isBeingPickedUp ? 1.0 : (proximity * 0.85 + item.hoverProgress * 0.35);
          haloMesh.material.opacity += (targetHaloOpacity - haloMesh.material.opacity) * (1.0 - Math.exp(-12.0 * delta));
        }
      });

      // Render the scene
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
      dom.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('dblclick', handleDblClick);
      dom.removeEventListener('pointerleave', handlePointerLeave);

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      controls.dispose();

      // Dispose all geometries
      astronautLoaderDisposed = true;
      dracoLoader.dispose();
      if (astronautModel) astronautBody.remove(astronautModel);
      astroEnvTexture.dispose();
      astroSuitMap.dispose();
      astroMaterials.forEach(m => m.dispose());
      nebulaGeo.dispose();
      particleGeo.dispose();
      upStreakBaseGeo.dispose();
      upStreakGeo.dispose();
      astroGeometries.forEach(g => g.dispose());
      rackBaseGeo.dispose();
      edgeNeonGeo.dispose();
      coinGeo.dispose();
      pedestalGeo.dispose();
      grooveGeo.dispose();
      ledGeo.dispose();
      streakGeo.dispose();
      emptyGlowGeo.dispose();
      haloGeo.dispose();
      hitProxyGeo.dispose();

      // Dispose all materials and canvas textures
      disposableMaterials.forEach(mat => mat.dispose());
      disposableTextures.forEach(tex => tex.dispose());

      if (dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
      renderer.dispose();
    };
  }, [
    TOTAL_COINS,
    createCoinBackFaceTexture,
    createCoinFaceTexture,
    focusCoinCamera,
    sharedReededBump,
    triggerCoinSelection
  ]);

  const activeFeature = COIN_FEATURES[activeUiIndex] || COIN_FEATURES[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#03040A] select-none text-slate-100">
      {/* 1. Cinematic Cosmic Vignette & Nebula Ambient Glows */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-[#03040A]/80 pointer-events-none z-15" />
      <div className="absolute top-0 right-0 w-[34rem] h-[34rem] bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none z-15" />
      <div className="absolute bottom-0 left-0 w-[34rem] h-[34rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-15" />

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

          {/* Backend / Ollama Status Pill */}
          <AiStatusPill
            backendOnline={backendOnline}
            ollamaStatus={ollamaStatus}
            isStarting={isStartingOllama}
            onStartOllama={onStartOllama}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b1714]/80 backdrop-blur-md border border-emerald-500/20 text-xs font-mono"
          />

          {/* Review Queue Count Pill if any */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{reviewCount} Needs Review</span>
            </div>
          )}
        </div>

        {/* Right Top Actions & 360° Camera Preset Pills */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
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

          {/* Keyboard & Controls Help */}
          <button
            onClick={() => setShowHelp(h => !h)}
            className="p-2 rounded-xl bg-[#0b1714]/80 hover:bg-[#122822] border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="360° Orbit & Camera Controls"
          >
            <HelpCircle className="size-4" />
          </button>
        </div>
      </header>

      {/* Floating 360° Camera Preset HUD (Top Right Sub-bar) */}
      <div className="absolute top-20 right-6 z-20 pointer-events-none hidden sm:flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0b1714]/85 backdrop-blur-xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-1.5 px-2 text-[11px] font-mono font-bold text-slate-400">
          <Camera className="size-3.5 text-emerald-400" />
          <span>Camera:</span>
        </div>

        {CAMERA_PRESETS.map(preset => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => activatePreset(preset.id)}
              className={`pointer-events-auto px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={`Switch to ${preset.label} Camera View`}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          );
        })}

        <button
          onClick={resetCamera}
          className="pointer-events-auto px-2 py-1 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer ml-1"
          title="Reset Camera (R key)"
        >
          <RotateCcw className="size-3" />
        </button>
      </div>

      {/* Subtle Hint: 360° Orbit Guidance */}
      <div className="absolute top-20 left-6 z-20 pointer-events-none hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0b1714]/75 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <Compass className="size-3.5 text-emerald-400 animate-spin-slow" />
        <span>Left Drag: 360° Orbit • Wheel: Zoom • Right Drag: Pan • Click: Open</span>
      </div>

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
                <Compass className="size-4 text-emerald-400" />
                360° Orbit & Camera Controls
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Orbit camera 360°</span>
                <span className="font-mono text-emerald-400 font-bold">Left Drag</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Zoom in / out</span>
                <span className="font-mono text-emerald-400 font-bold">Mouse Wheel / Pinch</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Pan camera</span>
                <span className="font-mono text-emerald-400 font-bold">Right Drag / 2-finger</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Focus camera on coin</span>
                <span className="font-mono text-emerald-400 font-bold">Double Click</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Pick up & open workspace</span>
                <span className="font-mono text-emerald-400 font-bold">Single Click / Enter</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Camera Presets</span>
                <span className="font-mono text-emerald-400 font-bold">Keys 1, 2, 3, 4</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Reset Camera</span>
                <span className="font-mono text-emerald-400 font-bold">Key R</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#071310] border border-slate-800">
                <span className="text-slate-400">Slide conveyor rack</span>
                <span className="font-mono text-emerald-400 font-bold">← / → or A / D</span>
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
