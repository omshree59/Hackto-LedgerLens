import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { NavItem } from '../layout/Sidebar';
import { Play, Pause, ChevronLeft, ChevronRight, Sparkles, Maximize2, Minimize2 } from 'lucide-react';

interface CoinFeature {
  id: NavItem;
  name: string;
  subtext: string;
  color: string;       // Rim & glow accent color
  faceColor: string;   // Face background color
  textColor: string;   // Text label color
  ledColor: string;    // Pedestal LED color
  badgeIcon: string;   // Short symbol or icon letter
}

const COIN_FEATURES: CoinFeature[] = [
  {
    id: 'overview',
    name: 'Overview',
    subtext: 'Dashboard & KPIs',
    color: '#10b981',
    faceColor: '#0a1a12',
    textColor: '#ffffff',
    ledColor: '#34d399',
    badgeIcon: '⊞'
  },
  {
    id: 'invoices',
    name: 'Invoices',
    subtext: 'Accounts Payable',
    color: '#3b82f6',
    faceColor: '#0c192e',
    textColor: '#ffffff',
    ledColor: '#60a5fa',
    badgeIcon: '📄'
  },
  {
    id: 'receipts',
    name: 'Receipts',
    subtext: 'Expense Slips',
    color: '#ef4444',
    faceColor: '#2b0d0d',
    textColor: '#ffffff',
    ledColor: '#f87171',
    badgeIcon: '🧾'
  },
  {
    id: 'review',
    name: 'Review Queue',
    subtext: 'Verification AI',
    color: '#f59e0b',
    faceColor: '#261806',
    textColor: '#ffffff',
    ledColor: '#fbbf24',
    badgeIcon: '⚠'
  },
  {
    id: 'vendors',
    name: 'Vendors',
    subtext: 'Merchant Profiles',
    color: '#8b5cf6',
    faceColor: '#1c1033',
    textColor: '#ffffff',
    ledColor: '#a78bfa',
    badgeIcon: '🏢'
  },
  {
    id: 'expenses',
    name: 'Expenses',
    subtext: 'Ledger Records',
    color: '#059669',
    faceColor: '#062419',
    textColor: '#ffffff',
    ledColor: '#10b981',
    badgeIcon: '💳'
  },
  {
    id: 'rules',
    name: 'Automation',
    subtext: 'Gemma Workflows',
    color: '#ec4899',
    faceColor: '#260a1a',
    textColor: '#ffffff',
    ledColor: '#f472b6',
    badgeIcon: '✦'
  },
  {
    id: 'reports',
    name: 'Reports',
    subtext: 'Fiscal Summaries',
    color: '#06b6d4',
    faceColor: '#082026',
    textColor: '#ffffff',
    ledColor: '#22d3ee',
    badgeIcon: '📊'
  },
  {
    id: 'settings',
    name: 'Settings',
    subtext: 'Privacy & Storage',
    color: '#94a3b8',
    faceColor: '#1e293b',
    textColor: '#ffffff',
    ledColor: '#cbd5e1',
    badgeIcon: '⚙'
  }
];

interface CoinRackViewerProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  isCompact?: boolean;
}

export const CoinRackViewer: React.FC<CoinRackViewerProps> = ({
  currentTab,
  onSelectTab,
  isCompact = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState<CoinFeature | null>(null);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const coinsGroupRef = useRef<THREE.Group | null>(null);
  const coinMeshesRef = useRef<Array<{ mesh: THREE.Group; feature: CoinFeature; index: number }>>([]);
  const animFrameRef = useRef<number | null>(null);
  const targetCamXRef = useRef<number>(0);

  // Helper to generate crisp canvas texture for coin face
  const createCoinFaceTexture = (feature: CoinFeature): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Dark circular face background
    ctx.fillStyle = feature.faceColor;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer metallic border rim ring
    ctx.lineWidth = 18;
    ctx.strokeStyle = feature.color;
    ctx.stroke();

    // 3. Inner concentric groove ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary subtle decorative dashed ring
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Subtle inner radial vignette/glow
    const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 220);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 225, 0, Math.PI * 2);
    ctx.fill();

    // 5. Center Feature Name Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge symbol / icon on top
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = feature.color;
    ctx.fillText(feature.badgeIcon, 256, 180);

    // Primary Name (e.g. "Braintree" style in photo)
    const fontSize = feature.name.length > 10 ? 42 : 48;
    ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = feature.textColor;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(feature.name, 256, 256);
    ctx.shadowBlur = 0;

    // Subtitle under name
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
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

    // Draw vertical stripes to simulate coin rim ridges
    for (let x = 0; x < 512; x += 4) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 0, 2, 32);
      ctx.fillStyle = '#202020';
      ctx.fillRect(x + 2, 0, 2, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(12, 1);
    return texture;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight || 280;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060c14); // Deep navy from image

    // Subtle blue atmospheric fog
    scene.fog = new THREE.FogExp2(0x060c14, 0.04);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 8.5);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x223355, 1.5);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainKeyLight.position.set(4, 10, 8);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    scene.add(mainKeyLight);

    const rimBlueLight = new THREE.DirectionalLight(0x4477ff, 3.0);
    rimBlueLight.position.set(-8, 3, -4);
    scene.add(rimBlueLight);

    const bottomGlowLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    bottomGlowLight.position.set(0, -5, 4);
    scene.add(bottomGlowLight);

    // 5. Coin Group & Rack
    const coinsGroup = new THREE.Group();
    coinsGroupRef.current = coinsGroup;
    scene.add(coinsGroup);

    const SPACING = 1.65;
    const TOTAL_WIDTH = (COIN_FEATURES.length - 1) * SPACING;
    const START_X = -TOTAL_WIDTH / 2;

    const reededBump = createReededBumpTexture();
    const coinMeshes: Array<{ mesh: THREE.Group; feature: CoinFeature; index: number }> = [];

    // Continuous base rail / conveyor dock underneath
    const rackBaseGeo = new THREE.BoxGeometry(TOTAL_WIDTH + 4, 0.6, 2.2);
    const rackBaseMat = new THREE.MeshStandardMaterial({
      color: 0x111c2e,
      roughness: 0.35,
      metalness: 0.7,
    });
    const rackBaseMesh = new THREE.Mesh(rackBaseGeo, rackBaseMat);
    rackBaseMesh.position.set(0, -0.45, 0);
    rackBaseMesh.receiveShadow = true;
    scene.add(rackBaseMesh);

    COIN_FEATURES.forEach((feature, idx) => {
      const posX = START_X + idx * SPACING;

      // Segment pedestal block with slot cutout
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(posX, -0.15, 0);

      // Block mesh
      const blockGeo = new THREE.BoxGeometry(1.4, 0.8, 1.8);
      const blockMat = new THREE.MeshStandardMaterial({
        color: 0x1a2638,
        metalness: 0.6,
        roughness: 0.4
      });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.receiveShadow = true;
      pedestalGroup.add(blockMesh);

      // Front LED indicator badge (like the glowing circles in the photo)
      const ledGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32);
      ledGeo.rotateX(Math.PI / 2);
      const ledMat = new THREE.MeshBasicMaterial({
        color: feature.ledColor
      });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0, -0.1, 0.91);
      pedestalGroup.add(ledMesh);

      // Downward vertical light streak on pedestal front
      const streakGeo = new THREE.PlaneGeometry(0.35, 0.55);
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
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      const streakMesh = new THREE.Mesh(streakGeo, streakMat);
      streakMesh.position.set(0, -0.45, 0.91);
      pedestalGroup.add(streakMesh);

      scene.add(pedestalGroup);

      // 6. 3D COIN MESH
      const coinGroup = new THREE.Group();
      coinGroup.position.set(posX, 0.7, 0);

      const coinRadius = 1.05;
      const coinThickness = 0.22;

      // Cylinder geometry: side face (0), top cap (1), bottom cap (2)
      const coinGeo = new THREE.CylinderGeometry(coinRadius, coinRadius, coinThickness, 64);

      // Face textures
      const faceTex = createCoinFaceTexture(feature);

      // Edge material with reeded fluting bump
      const edgeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(feature.color),
        metalness: 0.85,
        roughness: 0.25,
        bumpMap: reededBump,
        bumpScale: 0.08
      });

      // Front & back face materials
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        metalness: 0.4,
        roughness: 0.35
      });

      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, faceMat, faceMat]);
      coinMesh.rotation.x = Math.PI / 2; // Stand upright
      coinMesh.castShadow = true;
      coinMesh.receiveShadow = true;

      // Store feature reference on mesh userData for raycasting
      coinGroup.userData = { feature, index: idx };
      coinMesh.userData = { feature, index: idx };

      coinGroup.add(coinMesh);

      // Upward spotlight halo underneath the coin for when it gets picked up
      const haloGeo = new THREE.PlaneGeometry(1.2, 1.2);
      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = 128;
      haloCanvas.height = 128;
      const hCtx = haloCanvas.getContext('2d')!;
      const hGrad = hCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
      hGrad.addColorStop(0, feature.color);
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
      haloMesh.position.y = -0.55;
      coinGroup.add(haloMesh);

      coinsGroup.add(coinGroup);
      coinMeshes.push({ mesh: coinGroup, feature, index: idx });
    });

    coinMeshesRef.current = coinMeshes;

    // 7. Raycasting & Mouse Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
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
          onSelectTab(feat.id);
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
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
          setHoveredFeature(obj.userData.feature);
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredFeature(null);
      renderer.domElement.style.cursor = 'default';
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // 8. Render Animation Loop (60-120fps smooth video-like loop)
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Find active index to center camera smoothly
      const activeIdx = COIN_FEATURES.findIndex(f => f.id === currentTab);
      const activeTargetX = START_X + (activeIdx !== -1 ? activeIdx : 0) * SPACING;
      targetCamXRef.current = activeTargetX * 0.75;

      // Smooth camera dampening
      camera.position.x += (targetCamXRef.current - camera.position.x) * 0.05;
      camera.lookAt(camera.position.x * 0.9, 0.5, 0);

      // Animate each coin
      coinMeshes.forEach(({ mesh, feature, index }) => {
        const isActive = feature.id === currentTab;
        const isHovered = hoveredFeature?.id === feature.id;

        // Target elevation: Picked up when active or hovered!
        // When active, elevated high above the slot like "Braintree" in reference photo
        const targetY = isActive ? 1.45 : (isHovered ? 0.95 : 0.65);
        mesh.position.y += (targetY - mesh.position.y) * 0.12;

        // Subtle idle breathing motion loop
        if (isPlaying) {
          const idleTilt = Math.sin(elapsedTime * 1.8 + index * 0.6) * 0.04;
          const idleFloat = Math.sin(elapsedTime * 2.5 + index * 0.8) * 0.03;
          mesh.rotation.y = isActive ? idleTilt : idleTilt * 0.5;
          if (isActive) {
            mesh.position.y += idleFloat * 0.5;
          }
        }

        // Slight 3D dynamic tilt towards camera when elevated
        const targetRotX = isActive ? -0.1 : 0.0;
        mesh.rotation.x += (targetRotX - mesh.rotation.x) * 0.1;

        // Control under-coin glowing halo opacity
        const haloMesh = mesh.children[1] as THREE.Mesh | undefined;
        if (haloMesh && haloMesh.material instanceof THREE.MeshBasicMaterial) {
          const targetOpacity = isActive ? 0.85 : (isHovered ? 0.4 : 0.0);
          haloMesh.material.opacity += (targetOpacity - haloMesh.material.opacity) * 0.1;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 280;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [currentTab, onSelectTab, isPlaying]);

  // Navigate left/right across features
  const navigateStep = (direction: 'prev' | 'next') => {
    const curIndex = COIN_FEATURES.findIndex(f => f.id === currentTab);
    if (curIndex === -1) return;

    if (direction === 'prev' && curIndex > 0) {
      onSelectTab(COIN_FEATURES[curIndex - 1].id);
    } else if (direction === 'next' && curIndex < COIN_FEATURES.length - 1) {
      onSelectTab(COIN_FEATURES[curIndex + 1].id);
    }
  };

  const activeFeature = COIN_FEATURES.find(f => f.id === currentTab) || COIN_FEATURES[0];

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#060c14] via-[#091522] to-[#060c14] border border-[#182a3d] shadow-2xl overflow-hidden group">
      {/* Top Overlay Badge & Controls */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="size-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Interactive 3D Feature Rack</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live 60fps Loop
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Click any coin chip to elevate it and switch workspace</p>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setIsPlaying(prev => !prev)}
            className="p-1.5 rounded-lg bg-[#0e1d2d] border border-[#1f374e] text-slate-300 hover:text-white hover:bg-[#162c44] text-xs transition-colors cursor-pointer"
            title={isPlaying ? 'Pause looping motion' : 'Resume looping motion'}
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button
            onClick={() => navigateStep('prev')}
            className="p-1.5 rounded-lg bg-[#0e1d2d] border border-[#1f374e] text-slate-300 hover:text-white hover:bg-[#162c44] cursor-pointer"
            title="Previous Coin"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={() => navigateStep('next')}
            className="p-1.5 rounded-lg bg-[#0e1d2d] border border-[#1f374e] text-slate-300 hover:text-white hover:bg-[#162c44] cursor-pointer"
            title="Next Coin"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className={`w-full ${isCompact ? 'h-52' : 'h-64 sm:h-72'} cursor-grab active:cursor-grabbing transition-all`}
      />

      {/* Bottom Floating Info Pill showing active/hovered chip */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="px-4 py-1.5 rounded-full bg-[#091522]/90 backdrop-blur-md border border-[#1e3c54] shadow-lg flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full shadow-sm animate-pulse"
              style={{ backgroundColor: (hoveredFeature || activeFeature).color }}
            />
            <span className="font-bold text-white tracking-wide">
              {(hoveredFeature || activeFeature).name}
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            {(hoveredFeature || activeFeature).subtext}
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/25">
            Active Feature
          </span>
        </div>
      </div>
    </div>
  );
};
