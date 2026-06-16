import { requireNativeModule } from 'expo-modules-core';

const NativeModule = requireNativeModule('NotificationListener');

export function getPendingNotifications(): string[] {
  return NativeModule.getPendingNotifications() ?? [];
}

export function removePendingNotification(text: string): void {
  NativeModule.removePendingNotification(text);
}

export function clearPendingNotifications(): void {
  NativeModule.clearPendingNotifications();
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
