import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// A quick schema baseline for the next phases as well
export const bookingValidationSchema = z.object({
  name: z.string().trim().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z.string().regex(/^\d{10}$/, { message: 'Please enter a valid 10-digit mobile number.' }),
  vehicle: z.string().trim().toUpperCase().optional(),
  vtype: z.string().min(1, { message: 'Vehicle type is required.' }),
  booking_type: z.enum(['slot', 'pickup']),
  pickup_address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});