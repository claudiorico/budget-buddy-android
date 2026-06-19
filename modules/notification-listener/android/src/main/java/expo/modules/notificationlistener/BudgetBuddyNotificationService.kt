package expo.modules.notificationlistener

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import org.json.JSONArray

class BudgetBuddyNotificationService : NotificationListenerService() {

    companion object {
        private const val PREFS_NAME = "budget_buddy_notif"
        private const val KEY_PENDING_QUEUE = "pending_queue"
        private const val MAX_QUEUE_SIZE = 30
        private const val CHANNEL_ID = "budget_buddy_imports"
        private const val NOTIF_ID = 9901

        private val BANK_PACKAGES = setOf(
            "com.nu.production",                     // Nubank
            "com.bradesco",                          // Bradesco
            "com.santander.app",                     // Santander
            "com.samsung.android.spay",              // Samsung Pay
            "com.google.android.apps.walletnfcrel",  // Google Wallet
        )

        // Patterns that suggest a bank expense notification in Brazilian Portuguese
        private val BANK_PATTERNS = listOf(
            Regex("R\\$[\\s\\u00A0\\u202F]*\\d"),  // espaço normal, NBSP e narrow NBSP
            Regex("compra aprovada", RegexOption.IGNORE_CASE),
            Regex("pagamento.*aprovado", RegexOption.IGNORE_CASE),
            Regex("pix", RegexOption.IGNORE_CASE),
            Regex("débito.*realizado", RegexOption.IGNORE_CASE),
            Regex("transação.*aprovada", RegexOption.IGNORE_CASE),
            Regex("compra.*crédito", RegexOption.IGNORE_CASE),
        )

        private fun prefs(context: Context) =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun getPendingQueue(context: Context): List<String> {
            val raw = prefs(context).getString(KEY_PENDING_QUEUE, null) ?: return emptyList()
            val arr = JSONArray(raw)
            return (0 until arr.length()).map { arr.getString(it) }
        }

        fun addPendingText(context: Context, text: String) {
            val queue = (getPendingQueue(context) + text).takeLast(MAX_QUEUE_SIZE)
            saveQueue(context, queue)
        }

        fun removePendingText(context: Context, text: String) {
            val queue = getPendingQueue(context).toMutableList()
            queue.remove(text)
            saveQueue(context, queue)
        }

        fun clearPendingQueue(context: Context) {
            prefs(context).edit().remove(KEY_PENDING_QUEUE).apply()
        }

        private fun saveQueue(context: Context, queue: List<String>) {
            val arr = JSONArray()
            queue.forEach { arr.put(it) }
            prefs(context).edit().putString(KEY_PENDING_QUEUE, arr.toString()).apply()
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        if (sbn.packageName !in BANK_PACKAGES) return  // only whitelisted banks

        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val full = "$title $text".trim()

        if (full.isBlank()) return
        if (BANK_PATTERNS.none { it.containsMatchIn(full) }) return

        addPendingText(this, full)
        postCaptureNotification(full)
    }

    private fun postCaptureNotification(text: String) {
        ensureChannel()

        // Open the app's main activity when tapped
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        } ?: return

        val pi = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val shortText = if (text.length > 100) text.take(100) + "…" else text
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_add)
            .setContentTitle("Gasto capturado")
            .setContentText(shortText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(shortText))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, notification)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Gastos capturados",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificações bancárias capturadas para importação"
            }
        )
    }
}
