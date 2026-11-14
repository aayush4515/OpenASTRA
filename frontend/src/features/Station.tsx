import { Component, Suspense, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
export const equipment = [
  {
    id: 'camera',
    name: 'Optical array',
    detail: 'Live webcam · MediaPipe facial geometry. Crew identity requires manual confirmation.',
    position: [-0.88, 2.8, 0.05],
  },
  {
    id: 'thermal',
    name: 'Thermal module',
    detail: 'Simulated surface temperature. No thermal camera is connected.',
    position: [0.9, 2.72, 0.03],
  },
  {
    id: 'wearable',
    name: 'Wearable uplink',
    detail: 'Simulated resting pulse, sleep and activity from a modular wearable adapter.',
    position: [-1.15, 1.85, 0.12],
  },
  {
    id: 'vitals',
    name: 'Vitals console',
    detail: 'Simulated blood pressure and oxygen saturation with source and quality metadata.',
    position: [1.1, 1.9, 0.05],
  },
  {
    id: 'voc',
    name: 'Experimental e-nose',
    detail:
      'Six synthetic chemical-response channels. Research fingerprint only; no hormones or diagnoses.',
    position: [-1.17, 0.99, 0.08],
  },
  {
    id: 'blood',
    name: 'Portable lab',
    detail: 'User-triggered weekly sample simulation. Three illustrative laboratory indicators.',
    position: [1.17, 0.95, 0.05],
  },
  {
    id: 'mass',
    name: 'Inertial mass platform',
    detail: 'Microgravity body-mass concept using inertial response. Output is simulated.',
    position: [0, 0.14, 0.4],
  },
] as const;
function Box({
  position,
  size,
  color = '#223748',
  metal = 0.65,
  children,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  metal?: number;
  children?: ReactNode;
}) {
  return (
    <RoundedBox
      args={size}
      radius={0.035}
      smoothness={3}
      position={position}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} metalness={metal} roughness={0.36} />
      {children}
    </RoundedBox>
  );
}
function Astronaut() {
  return (
    <group position={[0, 0.28, 0.4]}>
      <Box position={[0, 1.08, -0.16]} size={[0.66, 0.85, 0.28]} color="#263e4c" />
      <mesh position={[0, 1.74, 0]} castShadow>
        <sphereGeometry args={[0.29, 40, 32]} />
        <meshStandardMaterial color="#d6e3e6" roughness={0.36} metalness={0.28} />
      </mesh>
      <mesh position={[0, 1.76, 0.108]} rotation={[-0.08, 0, 0]}>
        <sphereGeometry args={[0.251, 40, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color="#172e3d" metalness={0.85} roughness={0.19} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.52, 6, 24]} />
        <meshStandardMaterial color="#bdcdd3" roughness={0.7} />
      </mesh>
      <Box position={[0, 1.25, 0.24]} size={[0.33, 0.3, 0.075]} color="#334f5d" />
      <Box position={[0, 1.26, 0.285]} size={[0.2, 0.07, 0.015]} color="#5bdbc8" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <group position={[side * 0.35, 1.18, 0]} rotation={[0, 0, side * 0.13]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.105, 0.44, 6, 16]} />
              <meshStandardMaterial color="#9cbbc4" roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.35, 0.02]}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color="#d5e3e6" />
            </mesh>
          </group>
          <mesh position={[side * 0.15, 0.5, 0]} castShadow>
            <capsuleGeometry args={[0.125, 0.53, 6, 20]} />
            <meshStandardMaterial color="#b0c8ce" roughness={0.7} />
          </mesh>
          <Box position={[side * 0.15, 0.08, 0.07]} size={[0.26, 0.17, 0.4]} color="#4a626d" />
        </group>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.27, 0.26, 0.1, 24]} />
        <meshStandardMaterial color="#263f4d" />
      </mesh>
    </group>
  );
}
function Scan({ active, reduced }: { active: boolean; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && !reduced)
      ref.current.position.y = 0.5 + (Math.sin(clock.elapsedTime * 1.9) + 1) * 1.1;
  });
  return active ? (
    <mesh ref={ref} position={[0, 1.4, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 1.05, 64]} />
      <meshBasicMaterial color="#5fffe4" transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  ) : null;
}
function Scene({
  active,
  selected,
  onSelect,
  reduced,
}: {
  active: string;
  selected?: string;
  onSelect?: (id: string) => void;
  reduced: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#b9e7fa', '#18232a', 1.3]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={3.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-2, 3, 1]} color="#42cce4" intensity={12} />
      <pointLight position={[2, 2, -1]} color="#426fff" intensity={8} />
      <group position={[0, -1.5, 0]}>
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[1.7, 1.8, 0.15, 64]} />
          <meshStandardMaterial color="#14232e" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.57, 1.6, 80]} />
          <meshBasicMaterial color="#5bdbc8" />
        </mesh>
        <Box position={[0, 1.6, -0.63]} size={[2.9, 3.25, 0.16]} color="#142637" />
        <Box position={[0, 1.7, -0.51]} size={[1.42, 2.77, 0.12]} color="#203e4c" />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Box position={[side * 1.45, 1.6, -0.05]} size={[0.14, 3.2, 0.94]} color="#344e5c" />
            <Box position={[side * 1.32, 1.62, 0.44]} size={[0.04, 2.9, 0.035]} color="#62e3d4" />
            <Box position={[side * 0.72, 1.68, -0.4]} size={[0.035, 2.7, 0.025]} color="#4d9aaf" />
          </group>
        ))}
        <Box position={[0, 3.22, -0.04]} size={[3.05, 0.23, 1.08]} color="#415b68" />
        <Box position={[0, 3.08, 0.32]} size={[1.8, 0.04, 0.1]} color="#c3f5f4" />
        <Box position={[0, 2.78, -0.39]} size={[0.66, 0.24, 0.03]} color="#091d2b" />
        <Html
          position={[0, 2.79, -0.36]}
          transform
          distanceFactor={3}
          style={{ pointerEvents: 'none' }}
        >
          <div className="station-display">
            ASTRA <span>MED-01</span>
          </div>
        </Html>
        <Astronaut />
        {equipment.map((e) => {
          const isActive =
            active === e.id ||
            (active === 'sensors' && ['thermal', 'vitals', 'wearable', 'mass'].includes(e.id));
          const picked = selected === e.id;
          return (
            <group
              key={e.id}
              position={[...e.position]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(e.id);
              }}
              onPointerOver={() => {
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              {e.id === 'mass' ? null : (
                <>
                  <Box
                    position={[0, 0, 0]}
                    size={[0.47, 0.35, 0.3]}
                    color={picked ? '#387b83' : '#334e5c'}
                  />
                  <Box position={[0, 0, 0.16]} size={[0.35, 0.23, 0.025]} color="#071c28" />
                  <mesh position={[0.14, 0.12, 0.18]}>
                    <sphereGeometry args={[0.018, 12, 12]} />
                    <meshBasicMaterial color={isActive ? '#8affd6' : '#43b3c0'} />
                  </mesh>
                  {e.id === 'camera' ? (
                    <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.085, 0.085, 0.09, 24]} />
                      <meshStandardMaterial color="#72c8e8" metalness={0.8} roughness={0.1} />
                    </mesh>
                  ) : (
                    <Box
                      position={[0, 0, 0.18]}
                      size={[0.22, 0.025, 0.01]}
                      color={isActive ? '#96ffe4' : '#2c7686'}
                    />
                  )}
                </>
              )}
              {picked && (
                <Html position={[0, 0.34, 0.2]} center>
                  <div className="station-label">{e.name}</div>
                </Html>
              )}
            </group>
          );
        })}
        <Scan active={['camera', 'sensors', 'voc', 'blood'].includes(active)} reduced={reduced} />
        <ContactShadows position={[0, -0.045, 0]} opacity={0.45} scale={8} blur={2} far={5} />
      </group>
      <OrbitControls
        makeDefault
        minDistance={4.8}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={0.5}
        enablePan={false}
        target={[0, 0, 0]}
        autoRotate={false}
      />
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Station({
  active = '',
  selected,
  onSelect,
  compact = false,
}: {
  active?: string;
  selected?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const support = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallback = (
    <div className="station-fallback">
      <ScanIcon />
      <h3>Assessment station</h3>
      <p>
        3D rendering is unavailable. The equipment controls and full assessment remain available.
      </p>
    </div>
  );
  return (
    <div
      className={'station-canvas ' + (compact ? 'compact' : '')}
      aria-label="Interactive three-dimensional medical assessment booth"
    >
      {support ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{ position: [4, 2.4, 6], fov: 39 }}
              gl={{ antialias: true, alpha: true }}
            >
              <Scene active={active} selected={selected} onSelect={onSelect} reduced={reduced} />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
function ScanIcon() {
  return <div className="fallback-orbit">✧</div>;
}
