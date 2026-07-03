// components/booking/ClientAuthModal.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

type Stage = 'email' | 'otp';

interface ClientAuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export default function ClientAuthModal({ open, onClose, onAuthenticated }: ClientAuthModalProps) {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setIsSubmitting(false);
    if (otpError) {
      setError('Could not send the code. Please try again.');
      return;
    }
    setStage('otp');
  }

  async function handleVerifyOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    setIsSubmitting(false);
    if (verifyError) {
      setError('That code is incorrect or expired.');
      return;
    }
    setStage('email');
    setOtp('');
    onAuthenticated();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 className="text-base font-extrabold text-slate-900">Confirm it&apos;s you</h3>
            <p className="mt-1 text-xs text-slate-500">
              One quick step to secure your booking — we&apos;ll send a 6-digit code to your email.
            </p>

            {stage === 'email' && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  autoFocus
                />
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSubmitting}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending…' : 'Send Code'}
                  </button>
                </div>
              </div>
            )}

            {stage === 'otp' && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => setStage('email')} className="text-xs font-semibold text-slate-500">
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isSubmitting}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isSubmitting ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}