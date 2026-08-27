'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Pastel "sky" backdrop — soft translucent puffs drifting through Cloud space.
 * Purely ambient: pointer-events-none, behind all content, aria-hidden.
 * Isolated Canvas component so parent re-renders never remount the scene.
 */

type PuffConfig = {
  color: string;
  opacity: number;
  scale: number;
  speed: number;
  phase: number;
  x: number;
  y: number;
  z: number;
};

const PALETTE = ['#E8F6F0', '#B9B3F0', '#EFC272', '#F4F2FC', '#FF6B54'];

function Puff({ config }: { config: PuffConfig }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Framerate-independent drift; direct mutation only, zero re-renders
    meshRef.current.position.x = config.x + Math.sin(t * config.speed + config.phase) * 1.6;
    meshRef.current.position.y = config.y + Math.cos(t * config.speed * 0.8 + config.phase) * 1.1;
  });

  return (
    <mesh ref={meshRef} position={[config.x, config.y, config.z]} scale={config.scale}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial color={config.color} transparent opacity={config.opacity} depthWrite={false} />
    </mesh>
  );
}

function SkyScene() {
  const puffs = useMemo<PuffConfig[]>(() => {
    // Deterministic pseudo-random layout so SSR/CSR agree
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: 18 }, (_, i) => ({
      color: PALETTE[i % PALETTE.length],
      opacity: i % 5 === 4 ? 0.05 : 0.12 + rand() * 0.14,
      scale: 2.2 + rand() * 5.5,
      speed: 0.04 + rand() * 0.07,
      phase: rand() * Math.PI * 2,
      x: (rand() - 0.5) * 26,
      y: (rand() - 0.5) * 14,
      z: -4 - rand() * 8,
    }));
  }, []);

  return (
    <>
      {puffs.map((config, i) => (
        <Puff key={i} config={config} />
      ))}
    </>
  );
}

export function SkyCanvas() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={prefersReducedMotion ? 'demand' : 'always'}
        style={{ background: 'transparent' }}
      >
        <SkyScene />
      </Canvas>
    </div>
  );
}
