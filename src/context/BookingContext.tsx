// context/BookingContext.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

export type BookingStep =
  | 'service-selection'
  | 'center-selection'
  | 'date-time'
  | 'details'
  | 'review'
  | 'success';

export type ServiceType = 'slot' | 'pickup';
export type VehicleType = 'hatchback' | 'sedan' | 'suv' | 'muv_van' | 'truck_commercial' | 'two_wheeler';

const STEP_ORDER: BookingStep[] = [
  'service-selection',
  'center-selection',
  'date-time',
  'details',
  'review',
  'success',
];

export interface SelectedService {
  id: string;
  name: string;
  category: string | null;
  price: number;
  durationMinutes: number;
}

export interface SelectedCenter {
  id: string;
  name: string;
  address: string;
  phone: string;
  supportsPickup: boolean;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleType: VehicleType | '';
  notes: string;
  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
}

export interface BookingState {
  currentStep: BookingStep;
  furthestStepIndex: number;
  serviceType: ServiceType;
  service: SelectedService | null;
  center: SelectedCenter | null;
  date: string | null; // 'YYYY-MM-DD'
  time: string | null; // 'HH:mm'
  details: CustomerDetails;
  createdBookingId: string | null;
  isSubmitting: boolean;
  submitError: string | null;
}

const initialDetails: CustomerDetails = {
  name: '',
  phone: '',
  vehicleMake: '',
  vehicleModel: '',
  vehiclePlate: '',
  vehicleType: '',
  notes: '',
  pickupAddress: '',
  pickupLatitude: null,
  pickupLongitude: null,
};

const initialState: BookingState = {
  currentStep: 'service-selection',
  furthestStepIndex: 0,
  serviceType: 'slot',
  service: null,
  center: null,
  date: null,
  time: null,
  details: initialDetails,
  createdBookingId: null,
  isSubmitting: false,
  submitError: null,
};

type Action =
  | { type: 'SET_SERVICE_TYPE'; payload: ServiceType }
  | { type: 'SELECT_SERVICE'; payload: SelectedService }
  | { type: 'SELECT_CENTER'; payload: SelectedCenter }
  | { type: 'SET_DATE_TIME'; payload: { date: string; time: string } }
  | { type: 'UPDATE_DETAILS'; payload: Partial<CustomerDetails> }
  | { type: 'GO_TO_STEP'; payload: BookingStep }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: { bookingId: string } }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'RESET' };

function canLeaveStep(state: BookingState, step: BookingStep): boolean {
  switch (step) {
    case 'service-selection':
      return state.service !== null;
    case 'center-selection':
      return state.center !== null;
    case 'date-time':
      return state.date !== null && state.time !== null;
    case 'details':
      return (
        state.details.name.trim().length > 0 &&
        /^\d{10}$/.test(state.details.phone.trim()) &&
        (state.serviceType !== 'pickup' || state.details.pickupAddress.trim().length > 0)
      );
    default:
      return true;
  }
}

function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case 'SET_SERVICE_TYPE':
      return {
        ...state,
        serviceType: action.payload,
        // Changing service type invalidates a previously chosen center that
        // doesn't support pickup, and any already-picked slot.
        center: action.payload === 'pickup' && !state.center?.supportsPickup ? null : state.center,
      };

    case 'SELECT_SERVICE':
      return { ...state, service: action.payload };

    case 'SELECT_CENTER':
      return { ...state, center: action.payload, date: null, time: null };

    case 'SET_DATE_TIME':
      return { ...state, date: action.payload.date, time: action.payload.time };

    case 'UPDATE_DETAILS':
      return { ...state, details: { ...state.details, ...action.payload } };

    case 'GO_TO_STEP': {
      const targetIndex = STEP_ORDER.indexOf(action.payload);
      // Only allow jumping to a step that's within what's already been unlocked.
      if (targetIndex > state.furthestStepIndex) return state;
      return { ...state, currentStep: action.payload };
    }

    case 'NEXT_STEP': {
      if (!canLeaveStep(state, state.currentStep)) return state;
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
      return {
        ...state,
        currentStep: STEP_ORDER[nextIndex],
        furthestStepIndex: Math.max(state.furthestStepIndex, nextIndex),
      };
    }

    case 'PREV_STEP': {
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { ...state, currentStep: STEP_ORDER[prevIndex] };
    }

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };

    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        isSubmitting: false,
        createdBookingId: action.payload.bookingId,
        currentStep: 'success',
        furthestStepIndex: STEP_ORDER.length - 1,
      };

    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface BookingContextValue {
  state: BookingState;
  setServiceType: (type: ServiceType) => void;
  selectService: (service: SelectedService) => void;
  selectCenter: (center: SelectedCenter) => void;
  setDateTime: (date: string, time: string) => void;
  updateDetails: (patch: Partial<CustomerDetails>) => void;
  goToStep: (step: BookingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  submitStart: () => void;
  submitSuccess: (bookingId: string) => void;
  submitError: (message: string) => void;
  reset: () => void;
  canProceed: boolean;
  stepIndex: number;
  totalSteps: number;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setServiceType = useCallback((type: ServiceType) => dispatch({ type: 'SET_SERVICE_TYPE', payload: type }), []);
  const selectService = useCallback((service: SelectedService) => dispatch({ type: 'SELECT_SERVICE', payload: service }), []);
  const selectCenter = useCallback((center: SelectedCenter) => dispatch({ type: 'SELECT_CENTER', payload: center }), []);
  const setDateTime = useCallback((date: string, time: string) => dispatch({ type: 'SET_DATE_TIME', payload: { date, time } }), []);
  const updateDetails = useCallback((patch: Partial<CustomerDetails>) => dispatch({ type: 'UPDATE_DETAILS', payload: patch }), []);
  const goToStep = useCallback((step: BookingStep) => dispatch({ type: 'GO_TO_STEP', payload: step }), []);
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const submitStart = useCallback(() => dispatch({ type: 'SUBMIT_START' }), []);
  const submitSuccess = useCallback((bookingId: string) => dispatch({ type: 'SUBMIT_SUCCESS', payload: { bookingId } }), []);
  const submitErrorFn = useCallback((message: string) => dispatch({ type: 'SUBMIT_ERROR', payload: message }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const value = useMemo<BookingContextValue>(
    () => ({
      state,
      setServiceType,
      selectService,
      selectCenter,
      setDateTime,
      updateDetails,
      goToStep,
      nextStep,
      prevStep,
      submitStart,
      submitSuccess,
      submitError: submitErrorFn,
      reset,
      canProceed: canLeaveStep(state, state.currentStep),
      stepIndex: STEP_ORDER.indexOf(state.currentStep),
      totalSteps: STEP_ORDER.length,
    }),
    [state, setServiceType, selectService, selectCenter, setDateTime, updateDetails, goToStep, nextStep, prevStep, submitStart, submitSuccess, submitErrorFn, reset]
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within a BookingProvider');
  return ctx;
}