import { type ReactNode } from 'react';
import PageTransition from '@/components/motion/PageTransition';

// template.tsx re-mounts on every route change (unlike layout.tsx), which is
// what makes AnimatePresence inside PageTransition actually fire on
// navigation between the landing, booking, owner, and admin routes.
export default function RootTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
