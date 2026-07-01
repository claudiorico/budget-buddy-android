package expo.modules.notificationlistener

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

class BudgetBuddyNotificationService : NotificationListenerService() {

    companion object {
        private const val PREFS_NAME = "budget_buddy_notif"
        private const val KEY_PENDING_QUEUE = "pending_queue"
        private const val KEY_RECENT_EVENTS = "recent_events"
        private const val KEY_RECENT_NOTIFICATION_KEYS = "recent_notification_keys"
        private const val MAX_QUEUE_SIZE = 30
        private const val MAX_RECENT_EVENTS = 20
        private const val MAX_RECENT_NOTIFICATION_KEYS = 80
        private const val CHANNEL_ID = "budget_buddy_imports"
        private const val NOTIF_ID = 9901

        private val BANK_PACKAGES = setOf(
            "com.nu.production",                     // Nubank
            "com.itau",                              // Itaú
            "com.itau.pers",                         // Itaú (variações)
            "com.bradesco",                          // Bradesco
            "br.com.bradesco.next",                  // next
            "com.santander.app",                     // Santander
            "br.com.bb.android",                     // Banco do Brasil
            "br.com.intermedium",                    // Inter
            "br.com.c6bank.app",                     // C6 Bank
            "br.com.original.bank",                  // Banco Original
            "br.com.neon",                           // Neon
            "br.com.bancopan.cartoes",               // Banco PAN
            "br.gov.caixa.tem",                      // Caixa Tem
            "br.com.gabba.Caixa",                    // Caixa
            "com.mercadopago.wallet",                // Mercado Pago
            "com.picpay",                            // PicPay
            "com.paypal.android.p2pmobile",          // PayPal
            "com.samsung.android.spay",              // Samsung Pay
            "com.google.android.apps.walletnfcrel",  // Google Wallet
        )

        // Patterns that suggest a bank expense notification in Brazilian Portuguese.
        // Unicode escapes keep accented words stable even if a tool changes file encoding.
        private val BANK_PATTERNS = listOf(
            Regex("R\\$[\\s\\u00A0\\u202F]*\\d"), // normal space, NBSP and narrow NBSP
            Regex("compra aprovada", RegexOption.IGNORE_CASE),
            Regex("pagamento.*aprovado", RegexOption.IGNORE_CASE),
            Regex("pagamento.*realizado", RegexOption.IGNORE_CASE),
            Regex("pix", RegexOption.IGNORE_CASE),
            Regex("d\\u00E9bito.*realizado", RegexOption.IGNORE_CASE),
            Regex("transa\\u00E7\\u00E3o.*aprovada", RegexOption.IGNORE_CASE),
            Regex("compra.*cr\\u00E9dito", RegexOption.IGNORE_CASE),
            Regex("cart\\u00E3o", RegexOption.IGNORE_CASE),
        )

        private fun prefs(context: Context) =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun getPendingQueue(context: Context): List<String> {
            val raw = prefs(context).getString(KEY_PENDING_QUEUE, null) ?: return emptyList()
            val arr = JSONArray(raw)
            return (0 until arr.length()).map { arr.getString(it) }
        }

        fun addPendingText(context: Context, text: String): Boolean {
            val existing = getPendingQueue(context)
            val queue = (existing + text).takeLast(MAX_QUEUE_SIZE)
            saveQueue(context, queue)
            return true
        }

        private fun getRecentNotificationKeys(context: Context): List<String> {
            val raw = prefs(context).getString(KEY_RECENT_NOTIFICATION_KEYS, null) ?: return emptyList()
            val arr = JSONArray(raw)
            return (0 until arr.length()).map { arr.getString(it) }
        }

        private fun hasRecentNotificationKey(context: Context, key: String): Boolean =
            getRecentNotificationKeys(context).contains(key)

        private fun rememberNotificationKey(context: Context, key: String) {
            val keys = (listOf(key) + getRecentNotificationKeys(context).filterNot { it == key })
                .take(MAX_RECENT_NOTIFICATION_KEYS)
            val arr = JSONArray()
            keys.forEach { arr.put(it) }
            prefs(context).edit().putString(KEY_RECENT_NOTIFICATION_KEYS, arr.toString()).apply()
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

        fun getRecentEvents(context: Context): List<Map<String, Any>> {
            val raw = prefs(context).getString(KEY_RECENT_EVENTS, null) ?: return emptyList()
            val arr = JSONArray(raw)
            return (0 until arr.length()).map { index ->
                val item = arr.getJSONObject(index)
                mapOf(
                    "packageName" to item.optString("packageName"),
                    "text" to item.optString("text"),
                    "captured" to item.optBoolean("captured"),
                    "reason" to item.optString("reason"),
                    "timestamp" to item.optLong("timestamp"),
                    "notificationKey" to item.optString("notificationKey"),
                    "notificationId" to item.optInt("notificationId"),
                    "tag" to item.optString("tag"),
                    "postTime" to item.optLong("postTime"),
                )
            }
        }

        private fun addRecentEvent(
            context: Context,
            packageName: String,
            text: String,
            captured: Boolean,
            reason: String,
            notificationKey: String = "",
            notificationId: Int = 0,
            tag: String = "",
            postTime: Long = 0L,
        ) {
            val arr = JSONArray()
            val event = JSONObject()
                .put("packageName", packageName)
                .put("text", text.take(180))
                .put("captured", captured)
                .put("reason", reason)
                .put("timestamp", System.currentTimeMillis())
                .put("notificationKey", notificationKey)
                .put("notificationId", notificationId)
                .put("tag", tag)
                .put("postTime", postTime)

            arr.put(event)
            getRecentEvents(context).take(MAX_RECENT_EVENTS - 1).forEach { previous ->
                arr.put(JSONObject(previous))
            }
            prefs(context).edit().putString(KEY_RECENT_EVENTS, arr.toString()).apply()
        }

        private fun isLikelyFinancialPackage(packageName: String): Boolean {
            val lower = packageName.lowercase()
            return listOf(
                "bank", "banco", "wallet", "pay", "pix", "card", "cartao",
                "mercado", "picpay", "nubank", "itau", "bradesco", "santander",
                "intermedium", "c6", "caixa", "neon", "bb.android",
            ).any { lower.contains(it) }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val notificationKey = listOf(
            sbn.key,
            sbn.packageName,
            sbn.id.toString(),
            sbn.tag ?: "",
            sbn.postTime.toString(),
        ).joinToString("|")
        val eventTag = sbn.tag ?: ""

        val extras = sbn.notification?.extras ?: return
        val full = listOf(
            extras.getCharSequence("android.title")?.toString(),
            extras.getCharSequence("android.text")?.toString(),
            extras.getCharSequence("android.bigText")?.toString(),
            extras.getCharSequence("android.subText")?.toString(),
            extras.getCharSequence("android.summaryText")?.toString(),
            extras.getCharSequenceArray("android.textLines")?.joinToString(" "),
        )
            .filterNotNull()
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
        val captureKey = "$notificationKey|${full.hashCode()}"

        if (sbn.packageName == packageName) {
            addRecentEvent(this, sbn.packageName, full, false, "notificação do próprio app", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        if (full.isBlank()) {
            addRecentEvent(this, sbn.packageName, "", false, "texto vazio", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        val monitoredPackage = sbn.packageName in BANK_PACKAGES || isLikelyFinancialPackage(sbn.packageName)
        if (!monitoredPackage) {
            addRecentEvent(this, sbn.packageName, full, false, "pacote não monitorado", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        if (BANK_PATTERNS.none { it.containsMatchIn(full) }) {
            addRecentEvent(this, sbn.packageName, full, false, "texto sem valor/pix", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        if (hasRecentNotificationKey(this, captureKey)) {
            addRecentEvent(this, sbn.packageName, full, false, "notifica\u00E7\u00E3o Android repetida", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        rememberNotificationKey(this, captureKey)
        val added = addPendingText(this, full)
        if (!added) {
            addRecentEvent(this, sbn.packageName, full, false, "fila cheia ou não salvo", captureKey, sbn.id, eventTag, sbn.postTime)
            return
        }

        addRecentEvent(this, sbn.packageName, full, true, "capturado", captureKey, sbn.id, eventTag, sbn.postTime)
        postCaptureNotification(full)
    }

    private fun postCaptureNotification(text: String) {
        ensureChannel()

        // Open the expenses tab/import area when tapped.
        val launchIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("budgetbuddyandroid://expenses?importCaptures=1")
        ).apply {
            setPackage(packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

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
