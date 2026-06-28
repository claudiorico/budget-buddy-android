import { requireNativeModule } from 'expo-modules-core';

const NativeModule = requireNativeModule('NotificationListener');

export type NotificationDiagnosticEvent = {
  packageName: string;
  text: string;
  captured: boolean;
  reason: string;
  timestamp: number;
};

export type NotificationDiagnostics = {
  permissionGranted: boolean;
  pendingCount: number;
  recentEvents: NotificationDiagnosticEvent[];
};

export function getPendingNotifications(): string[] {
  return NativeModule.getPendingNotifications() ?? [];
}

export function removePendingNotification(text: string): void {
  NativeModule.removePendingNotification(text);
}

export function clearPendingNotifications(): void {
  NativeModule.clearPendingNotifications();
}

export function getDiagnostics(): NotificationDiagnostics {
  const result = NativeModule.getDiagnostics?.() ?? {};
  return {
    permissionGranted: Boolean(result.permissionGranted),
    pendingCount: Number(result.pendingCount ?? 0),
    recentEvents: Array.isArray(result.recentEvents) ? result.recentEvents : [],
  };
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
