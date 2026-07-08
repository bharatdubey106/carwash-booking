'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface HeroProps {
  whatsappNumber: string;
}

export default function Hero({ whatsappNumber }: HeroProps) {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE_OUT_EXPO },
  });

  return (
    <section className="hero-grid hero-glow relative overflow-hidden bg-slate-950 px-6 py-24 text-white sm:py-32">
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.span
          {...fadeUp(0)}
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-200 backdrop-blur"
        >
          ✦ Zero waiting · Premium experience
        </motion.span>

        <motion.h1 {...fadeUp(0.08)} className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Skip the Queue.
          <br />
          <em className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text not-italic text-transparent">Book Your Slot.</em>
        </motion.h1>

        <motion.p {...fadeUp(0.16)} className="mt-5 max-w-xl text-balance text-base text-slate-300 sm:text-lg">
          Choose your wash, pick a center nearby, select a slot — all done in under a minute. We confirm via WhatsApp.
        </motion.p>

        <motion.div {...fadeUp(0.24)} className="mt-8 flex flex-col gap-3 sm:flex-row">
          
          <Link
            href="#booking"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Book a Slot
          </Link>
          
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            💬 Chat With Us
          </a>
          
        </motion.div>

        <motion.div {...fadeUp(0.32)} className="mt-14 grid w-full max-w-lg grid-cols-4 gap-4">
          {[
            ['500+', 'Happy Customers'],
            ['4.9★', 'Rating'],
            ['<1 min', 'To Book'],
            ['0', 'Waiting'],
          ].map(([num, label]) => (
            <div key={label}>
              <div className="text-xl font-extrabold sm:text-2xl">{num}</div>
              <div className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}