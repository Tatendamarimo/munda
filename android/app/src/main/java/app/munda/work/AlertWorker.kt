package app.munda.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.munda.MainActivity
import app.munda.MundaApp
import app.munda.R
import java.util.concurrent.TimeUnit

/**
 * Checks the farmer's group for a new confirmed alert and shows it as a phone notification, even
 * when Munda is closed. Runs about every 30 minutes when there is signal (Android decides exactly).
 */
class AlertWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as MundaApp).container
        val g = c.groups.group.value ?: return Result.success()
        val latest = c.groups.latestAlert(g.orgId) ?: return Result.success()
        val sp = applicationContext.getSharedPreferences("alerts", Context.MODE_PRIVATE)
        if (sp.getString(SEEN, null) == latest.id) return Result.success()
        sp.edit().putString(SEEN, latest.id).apply()
        val lang = c.prefs.value.lang ?: "en"
        val title = c.i18n.t(lang, "home.groupAlert")
        val body = listOfNotNull(latest.message.ifBlank { null } ?: latest.problem, latest.area).joinToString(" · ")
        notify(applicationContext, latest.id.hashCode(), title, body)
        return Result.success()
    }

    companion object {
        private const val NAME = "group-alerts"
        private const val CHANNEL = "group-alerts"
        private const val SEEN = "seen"

        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<AlertWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancel(context: Context) = WorkManager.getInstance(context).cancelUniqueWork(NAME)

        fun notify(context: Context, id: Int, title: String, body: String) {
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, title, NotificationManager.IMPORTANCE_HIGH))
            val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
            NotificationManagerCompat.from(context).notify(id, NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(open).setAutoCancel(true).build())
        }
    }
}
