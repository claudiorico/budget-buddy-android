package expo.modules.notificationlistener

import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NotificationListener")

        Function("getPendingNotifications") {
            val ctx = appContext.reactContext ?: return@Function emptyList<String>()
            BudgetBuddyNotificationService.getPendingQueue(ctx)
        }

        Function("removePendingNotification") { text: String ->
            appContext.reactContext?.also { ctx ->
                BudgetBuddyNotificationService.removePendingText(ctx, text)
            }
            null
        }

        Function("clearPendingNotifications") {
            appContext.reactContext?.also { ctx ->
                BudgetBuddyNotificationService.clearPendingQueue(ctx)
            }
            null
        }

        Function("isPermissionGranted") {
            val ctx = appContext.reactContext ?: return@Function false
            val enabled = Settings.Secure.getString(
                ctx.contentResolver, "enabled_notification_listeners"
            ) ?: ""
            enabled.contains(ctx.packageName)
        }

        Function("openPermissionSettings") {
            appContext.reactContext?.also { ctx ->
                val intent = android.content.Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                    flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                }
                ctx.startActivity(intent)
            }
            null
        }

        Function("simulateCapture") { text: String ->
            appContext.reactContext?.also { ctx ->
                BudgetBuddyNotificationService.addPendingText(ctx, text)
            }
            null
        }
    }
}
