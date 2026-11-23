package app.munda.work

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import app.munda.MundaApp
import app.munda.data.inference.AiOutcome
import app.munda.data.inference.ObservationInput
import app.munda.domain.ReviewStatus
import app.munda.domain.Route
import java.util.concurrent.TimeUnit

/**
 * Work that needs signal. WorkManager persists it across app restarts and reboots and runs it
 * when the network constraint is met: the "when connected" half of Munda. Unique names make
 * enqueueing idempotent per observation.
 */
class WorkScheduler(context: Context) {
    private val wm = WorkManager.getInstance(context)
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun buildRecordWhenOnline(orgId: String, id: String) = enqueue<RecordWorker>("record-$id", orgId, id)
    fun reviewWhenOnline(orgId: String, id: String) = enqueue<ReviewWorker>("review-$id", orgId, id)

    private inline fun <reified W : CoroutineWorker> enqueue(name: String, orgId: String, id: String) {
        val request = OneTimeWorkRequestBuilder<W>()
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .setInputData(workDataOf(KEY_ORG to orgId, KEY_ID to id))
            .build()
        wm.enqueueUniqueWork(name, ExistingWorkPolicy.KEEP, request)
    }

    companion object {
        const val KEY_ORG = "orgId"
        const val KEY_ID = "id"
        const val MAX_ATTEMPTS = 6
    }
}

/** Builds the record for observations saved with no on-device model and no signal. */
class RecordWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as MundaApp).container
        val orgId = inputData.getString(WorkScheduler.KEY_ORG) ?: return Result.failure()
        val id = inputData.getString(WorkScheduler.KEY_ID) ?: return Result.failure()
        val o = c.repository.get(orgId, id) ?: return Result.failure()
        if (o.record != null) { c.scheduler.reviewWhenOnline(orgId, id); return Result.success() }

        val input = ObservationInput(o.crop, o.plot, o.cropStage, o.description, o.core, o.followUps, photo = null)
        return when (val out = c.ai.buildRecord(input, Route.CLOUD)) {
            is AiOutcome.Done -> {
                c.repository.saveRecord(orgId, id, out.value, out.origin)
                c.scheduler.reviewWhenOnline(orgId, id)
                Result.success()
            }
            is AiOutcome.Deferred -> Result.retry()
            is AiOutcome.Failed -> {
                Log.w(TAG, "Record failed for $id: ${out.reason}")
                if (runAttemptCount + 1 >= WorkScheduler.MAX_ATTEMPTS) {
                    c.repository.saveRecordError(orgId, id, out.reason); Result.failure()
                } else Result.retry()
            }
        }
    }

    private companion object { const val TAG = "RecordWorker" }
}

/** Reviews an observation against the plot's and farm's history once it can reach the cloud. */
class ReviewWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as MundaApp).container
        val orgId = inputData.getString(WorkScheduler.KEY_ORG) ?: return Result.failure()
        val id = inputData.getString(WorkScheduler.KEY_ID) ?: return Result.failure()
        return try {
            val o = c.repository.get(orgId, id) ?: return Result.failure()
            if (o.record == null) return Result.success() // RecordWorker chains a review later.
            c.repository.saveReview(orgId, id, ReviewStatus.DONE, c.reviewer.review(o))
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Review failed for $id (attempt $runAttemptCount)", e)
            if (runAttemptCount + 1 >= WorkScheduler.MAX_ATTEMPTS) {
                c.repository.saveReview(orgId, id, ReviewStatus.FAILED, null); Result.failure()
            } else Result.retry()
        }
    }

    private companion object { const val TAG = "ReviewWorker" }
}
