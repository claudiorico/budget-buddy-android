const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_CLASS = 'expo.modules.notificationlistener.BudgetBuddyNotificationService';
const BIND_PERMISSION = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const LISTENER_ACTION = 'android.service.notification.NotificationListenerService';

module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    if (!application.service) application.service = [];

    const alreadyAdded = application.service.some(
      (s) => s.$?.['android:name'] === SERVICE_CLASS
    );
    if (alreadyAdded) return config;

    application.service.push({
      $: {
        'android:name': SERVICE_CLASS,
        'android:label': '@string/app_name',
        'android:permission': BIND_PERMISSION,
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': LISTENER_ACTION } }],
        },
      ],
    });

    return config;
  });
};
