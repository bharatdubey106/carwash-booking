'use client';

import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html, PerformanceMonitor } from '@react-three/drei';
import { useState } from 'react';

/**
 * Usage: this component must be dynamically imported with ssr:false wherever
 * it's used, since @react-three/fiber touches the WebGL context which does
 * not exist server-side.
 *
 *   const CarCanvas = dynamic(() => import('@/components/3d/CarCanvas'), {
 *     ssr: false,
 *     loading: () => <CarCanvasSkeleton />,
 *   });
 */

type CarCanvasProps = {
  children: ReactNode;
  /** Locks vertical orbit so the model can't be viewed from directly above/below. */
  minPolarAngle?: number;
  maxPolarAngle?: number;
  /** Locks horizontal orbit to a controlled arc, mirroring Apple product viewers. */
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  enableZoom?: boolean;
  autoRotate?: boolean;
  className?: string;
};

function LoaderFallback() {
  return (
    <Html center>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '3px solid rgba(37,99,235,0.15)',
            borderTopColor: '#2563EB',
            animation: 'car-canvas-spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Loading model…</span>
        <style>{`@keyframes car-canvas-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Html>
  );
}

function StudioLightingRig() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[-5, 3, -2]} intensity={0.5} color="#60A5FA" />
      <directionalLight position={[0, 2, -6]} intensity={0.6} color="#ffffff" />
      <Environment preset="studio" />
    </>
  );
}

export default function CarCanvas({
  children,
  minPolarAngle = Math.PI / 3.2,
  maxPolarAngle = Math.PI / 2.1,
  minAzimuthAngle = -Math.PI / 2.5,
  maxAzimuthAngle = Math.PI / 2.5,
  enableZoom = false,
  autoRotate = false,
  className,
}: CarCanvasProps) {
  const [dpr, setDpr] = useState<[number, number]>([1, 1.5]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        dpr={dpr}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        camera={{ position: [0, 1.4, 5.5], fov: 32 }}
        style={{ background: 'transparent' }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr([1, 1])}
          onIncline={() => setDpr([1, 1.5])}
        />
        <StudioLightingRig />

        <Suspense fallback={<LoaderFallback />}>
          {children}
          <ContactShadows
            position={[0, -0.02, 0]}
            opacity={0.45}
            scale={10}
            blur={2.4}
            far={4}
            resolution={512}
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={enableZoom}
          minPolarAngle={minPolarAngle}
          maxPolarAngle={maxPolarAngle}
          minAzimuthAngle={minAzimuthAngle}
          maxAzimuthAngle={maxAzimuthAngle}
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

export function CarCanvasSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.06), transparent 70%)',
      }}
      aria-hidden
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '3px solid rgba(37,99,235,0.15)',
          borderTopColor: '#2563EB',
          animation: 'car-canvas-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes car-canvas-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
