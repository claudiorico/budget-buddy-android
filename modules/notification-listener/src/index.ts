import { requireNativeModule } from 'expo-modules-core';

const NativeModule = requireNativeModule('NotificationListener');

export function getPendingNotification(): string | null {
  return NativeModule.getPendingNotification() ?? null;
}

export function clearPendingNotification(): void {
  NativeModule.clearPendingNotification();
}

export function isPermissionGranted(): boolean {
  return NativeModule.isPermissionGranted() ?? false;
}

export function openPermissionSettings(): void {
  NativeModule.openPermissionSettings();
}

/** Dev-only: simulates a captured bank notification for testing. */
export function simulateCapture(text: string): void {
  NativeModule.simulateCapture(text);
}
