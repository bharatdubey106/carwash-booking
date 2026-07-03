// components/3d/CarModel.tsx
'use client';

import { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CarModelProps {
  /** Target Y-axis rotation in radians, driven by the selected service. */
  targetRotationY: number;
  /** True when "Pickup & Drop" is the active service type — lifts the car
   *  slightly, evoking it being loaded onto a flatbed. */
  lifted: boolean;
}

export default function CarModel({ targetRotationY, lifted }: CarModelProps) {
  const group = useRef<THREE.Group>(null!);
  const { scene } = useGLTF('/models/car.glb');

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotationY, 4, delta);
    const targetY = lifted ? 0.12 : 0;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 5, delta);
  });

  return <primitive ref={group} object={scene} scale={1.1} dispose={null} />;
}

useGLTF.preload('/models/car.glb');