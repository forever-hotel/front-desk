'use client';
import { useMutation } from '@tanstack/react-query';
import { issueFossGuestQr } from '../api/foss-guest-qr.api';

export function useFossGuestQr() {
  return useMutation({ mutationFn: issueFossGuestQr });
}
