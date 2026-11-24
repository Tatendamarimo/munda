package app.munda.data

import android.util.Log
import app.munda.domain.AffectedArea
import app.munda.domain.CoreAnswers
import app.munda.domain.Crop
import app.munda.domain.CropStage
import app.munda.domain.FieldRecord
import app.munda.domain.FindingSource
import app.munda.domain.HistoryReview
import app.munda.domain.InferenceOrigin
import app.munda.domain.Likelihood
import app.munda.domain.Observation
import app.munda.domain.Onset
import app.munda.domain.Pattern
import app.munda.domain.PatternKind
import app.munda.domain.PossibleCause
import app.munda.domain.QA
import app.munda.domain.Rainfall
import app.munda.domain.ReviewStatus
import app.munda.domain.Urgency
import com.google.firebase.Firebase
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Source
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/** An observation plus whether Firestore has acknowledged it (false = only on this phone so far). */
data class ObservationItem(val observation: Observation, val synced: Boolean)

/**
 * Firestore is both the system of record and the offline queue: writes land in the persistent
 * local cache immediately and sync when signal returns. We never await a write's server ack on
 * the UI path, because offline that Task only completes after reconnect.
 *
 * Layout: orgs/{orgId}/observations/{id}. An org is a farm, cooperative or extension group.
 */
class ObservationRepository {
    private val db = Firebase.firestore
    private val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun col(orgId: String): CollectionReference = db.collection("orgs").document(orgId).collection("observations")

    fun newId(orgId: String): String = col(orgId).document().id

    fun observeRecent(orgId: String, limit: Long = 100): Flow<List<ObservationItem>> = callbackFlow {
        val reg = col(orgId).orderBy("createdAtMillis", Query.Direction.DESCENDING).limit(limit)
            .addSnapshotListener(MetadataChanges.INCLUDE) { snap, err ->
                if (err != null) { Log.w(TAG, "Listener error", err); return@addSnapshotListener }
                trySend(snap?.documents.orEmpty().mapNotNull { d -> d.toObservation()?.let { ObservationItem(it, !d.metadata.hasPendingWrites()) } })
            }
        awaitClose { reg.remove() }
    }

    fun observe(orgId: String, id: String): Flow<ObservationItem?> = callbackFlow {
        val reg = col(orgId).document(id).addSnapshotListener(MetadataChanges.INCLUDE) { d, err ->
            if (err != null) { Log.w(TAG, "Listener error", err); return@addSnapshotListener }
            trySend(d?.toObservation()?.let { ObservationItem(it, !d.metadata.hasPendingWrites()) })
        }
        awaitClose { reg.remove() }
    }

    /** Fire-and-forget create; durable locally the moment this returns. */
    fun create(o: Observation) {
        val ref = col(o.orgId).document(o.id)
        ref.set(o.toCreateMap()).addOnFailureListener { e ->
            // On flaky connections Firestore can re-send a create whose first attempt already
            // committed. The rules reject the replay (it would overwrite a later record/review),
            // so confirm our document is there before treating it as a failure. The replay can
            // coincide with a sign-in token refresh, hence a few delayed checks.
            if ((e as? FirebaseFirestoreException)?.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                background.launch {
                    for (wait in longArrayOf(500, 2000, 5000)) {
                        delay(wait)
                        val server = runCatching { ref.get(Source.SERVER).await() }.getOrNull() ?: continue
                        if (server.exists() && server.getString("ownerUid") == o.ownerUid) {
                            Log.i(TAG, "Observation ${o.id} already saved; duplicate send ignored")
                            return@launch
                        }
                        if (!server.exists()) break
                    }
                    Log.e(TAG, "Create rejected for ${o.id}", e)
                }
            } else Log.e(TAG, "Create rejected for ${o.id}", e)
        }
    }

    fun saveRecord(orgId: String, id: String, record: FieldRecord, origin: InferenceOrigin) {
        col(orgId).document(id).update(
            mapOf("record" to record.toMap(), "origin" to origin.name, "recordError" to null, "updatedAt" to FieldValue.serverTimestamp())
        ).addOnFailureListener { Log.e(TAG, "Record update rejected for $id", it) }
    }

    fun saveRecordError(orgId: String, id: String, message: String) {
        col(orgId).document(id).update(mapOf("recordError" to message.take(200), "updatedAt" to FieldValue.serverTimestamp()))
    }

    fun saveReview(orgId: String, id: String, status: ReviewStatus, review: HistoryReview?) {
        col(orgId).document(id).update(
            mapOf("reviewStatus" to status.name, "review" to review?.toMap(), "updatedAt" to FieldValue.serverTimestamp())
        ).addOnFailureListener { Log.e(TAG, "Review update rejected for $id", it) }
    }

    /** Default source: server when online, cache when offline. */
    suspend fun get(orgId: String, id: String): Observation? = col(orgId).document(id).get().await().toObservation()

    suspend fun historyForPlot(orgId: String, plotKey: String, sinceMillis: Long, limit: Long = 20): List<Observation> =
        col(orgId).whereEqualTo("plotKey", plotKey)
            .whereGreaterThanOrEqualTo("createdAtMillis", sinceMillis)
            .orderBy("createdAtMillis", Query.Direction.DESCENDING).limit(limit)
            .get().await().documents.mapNotNull { it.toObservation() }

    suspend fun recentOnFarm(orgId: String, sinceMillis: Long, limit: Long = 40): List<Observation> =
        col(orgId).whereGreaterThanOrEqualTo("createdAtMillis", sinceMillis)
            .orderBy("createdAtMillis", Query.Direction.DESCENDING).limit(limit)
            .get().await().documents.mapNotNull { it.toObservation() }

    private companion object {
        const val TAG = "ObservationRepository"
        const val SCHEMA_VERSION = 1L
    }

    // ---- Mapping. Explicit maps (not reflection): R8-safe and matches firestore.rules exactly. ----

    private fun Observation.toCreateMap(): Map<String, Any?> = mapOf(
        "schemaVersion" to SCHEMA_VERSION,
        "id" to id,
        "orgId" to orgId,
        "ownerUid" to ownerUid,
        "plot" to plot,
        "plotKey" to plotKey,
        "crop" to crop.name,
        "cropStage" to cropStage.name,
        "description" to description,
        "core" to mapOf("area" to core.area.name, "rainfall" to core.rainfall.name, "onset" to core.onset.name),
        "followUps" to followUps.map { mapOf("q" to it.question, "a" to it.answer) },
        "hadPhoto" to hadPhoto,
        "record" to record?.toMap(),
        "origin" to origin.name,
        "createdAtMillis" to createdAtMillis,
        "reviewStatus" to reviewStatus.name,
        "review" to null,
        "recordError" to recordError,
        "area" to area,
        "cell" to cell,
        "syncedAt" to FieldValue.serverTimestamp(),
    )

    private fun PossibleCause.toMap() = mapOf(
        "guideId" to guideId, "name" to name, "likelihood" to likelihood.name,
        "supporting" to supporting, "againstOrMissing" to againstOrMissing, "checkNext" to checkNext,
    )

    private fun FieldRecord.toMap() = mapOf(
        "summary" to summary, "symptoms" to symptoms, "possibleCauses" to possibleCauses.map { it.toMap() },
        "urgency" to urgency.name, "uncertaintyNote" to uncertaintyNote,
    )

    private fun HistoryReview.toMap() = mapOf(
        "summary" to summary,
        "patterns" to patterns.map { mapOf("kind" to it.kind.name, "summary" to it.summary, "relatedIds" to it.relatedIds, "source" to it.source.name) },
        "updatedCauses" to updatedCauses.map { it.toMap() },
        "nextChecks" to nextChecks,
        "reviewedAtMillis" to reviewedAtMillis,
        "historyConsidered" to historyConsidered.toLong(),
    )

    private fun DocumentSnapshot.toObservation(): Observation? {
        if (!exists()) return null
        return try {
            val core = get("core") as? Map<*, *>
            Observation(
                id = getString("id") ?: id,
                orgId = getString("orgId").orEmpty(),
                ownerUid = getString("ownerUid").orEmpty(),
                crop = Crop.parse(getString("crop")),
                plot = getString("plot").orEmpty(),
                plotKey = getString("plotKey").orEmpty(),
                cropStage = CropStage.parse(getString("cropStage")),
                description = getString("description").orEmpty(),
                core = CoreAnswers(
                    AffectedArea.parse(core?.get("area") as? String),
                    Rainfall.parse(core?.get("rainfall") as? String),
                    Onset.parse(core?.get("onset") as? String),
                ),
                followUps = (get("followUps") as? List<*>).orEmpty().filterIsInstance<Map<*, *>>()
                    .map { QA(it["q"] as? String ?: "", it["a"] as? String ?: "") },
                hadPhoto = getBoolean("hadPhoto") ?: false,
                record = (get("record") as? Map<*, *>)?.toRecord(),
                origin = InferenceOrigin.parse(getString("origin")),
                createdAtMillis = getLong("createdAtMillis") ?: 0L,
                reviewStatus = ReviewStatus.parse(getString("reviewStatus")),
                review = (get("review") as? Map<*, *>)?.toReview(),
                recordError = getString("recordError"),
                area = getString("area"),
                cell = getString("cell"),
            )
        } catch (e: Exception) {
            Log.w(TAG, "Skipping malformed observation ${this.id}", e)
            null
        }
    }

    private fun Any?.strings(): List<String> = (this as? List<*>).orEmpty().filterIsInstance<String>()

    private fun Map<*, *>.toCause() = PossibleCause(
        guideId = this["guideId"] as? String,
        name = this["name"] as? String ?: "",
        likelihood = Likelihood.parse(this["likelihood"] as? String),
        supporting = this["supporting"].strings(),
        againstOrMissing = this["againstOrMissing"].strings(),
        checkNext = this["checkNext"] as? String ?: "",
    )

    private fun Map<*, *>.toRecord() = FieldRecord(
        summary = this["summary"] as? String ?: "",
        symptoms = this["symptoms"].strings(),
        possibleCauses = (this["possibleCauses"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().map { it.toCause() },
        urgency = Urgency.parse(this["urgency"] as? String),
        uncertaintyNote = this["uncertaintyNote"] as? String ?: "",
    )

    private fun Map<*, *>.toReview() = HistoryReview(
        summary = this["summary"] as? String ?: "",
        patterns = (this["patterns"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().map {
            Pattern(PatternKind.parse(it["kind"] as? String), it["summary"] as? String ?: "", it["relatedIds"].strings(), FindingSource.parse(it["source"] as? String))
        },
        updatedCauses = (this["updatedCauses"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().map { it.toCause() },
        nextChecks = this["nextChecks"].strings(),
        reviewedAtMillis = (this["reviewedAtMillis"] as? Number)?.toLong() ?: 0L,
        historyConsidered = (this["historyConsidered"] as? Number)?.toInt() ?: 0,
    )
}
