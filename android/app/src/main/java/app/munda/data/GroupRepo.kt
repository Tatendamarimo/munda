package app.munda.data

import android.content.Context
import androidx.core.content.edit
import com.google.firebase.Firebase
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Group(val orgId: String, val name: String, val role: String)

data class GroupAlert(val id: String, val problem: String, val area: String?, val count: Int, val message: String, val createdAt: Long)

/**
 * The cooperative this phone reports into, if any (web: data/group.ts). While in a group, new
 * checks go to the group's farm, where its extension officer sees them; leaving returns to the
 * private farm. Officers start groups from the web app.
 */
class GroupRepo(context: Context) {
    private val sp = context.getSharedPreferences("group", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val db get() = Firebase.firestore
    private val _group = MutableStateFlow(runCatching { sp.getString(KEY, null)?.let { json.decodeFromString(Group.serializer(), it) } }.getOrNull())
    val group: StateFlow<Group?> = _group.asStateFlow()

    private fun set(g: Group?) {
        _group.value = g
        sp.edit { if (g == null) remove(KEY) else putString(KEY, json.encodeToString(Group.serializer(), g)) }
    }

    /** Joining needs signal once: the rules check the group exists. Throws if the code is wrong. */
    suspend fun join(uid: String, code: String, myName: String): Group {
        val orgId = normalizeCode(code)
        require(Regex("^g-[A-Z2-9]{6}$").matches(orgId)) { "bad-code" }
        db.collection("orgs").document(orgId).collection("members").document(uid)
            .set(mapOf("role" to "farmer", "name" to myName.trim().take(40).ifBlank { null }, "joinedAt" to FieldValue.serverTimestamp())).await()
        val name = runCatching { db.collection("orgs").document(orgId).get().await().getString("name") }.getOrNull() ?: orgId.drop(2)
        return Group(orgId, name, "farmer").also(::set)
    }

    suspend fun leave(uid: String) {
        val g = _group.value ?: return
        set(null)
        runCatching { db.collection("orgs").document(g.orgId).collection("members").document(uid).delete().await() }
    }

    fun alerts(orgId: String): Flow<List<GroupAlert>> = callbackFlow {
        val reg = db.collection("orgs").document(orgId).collection("alerts")
            .orderBy("createdAt", Query.Direction.DESCENDING).limit(20)
            .addSnapshotListener { snap, _ -> trySend(snap?.documents.orEmpty().map { it.toAlert() }) }
        awaitClose { reg.remove() }
    }

    suspend fun latestAlert(orgId: String): GroupAlert? = runCatching {
        db.collection("orgs").document(orgId).collection("alerts").orderBy("createdAt", Query.Direction.DESCENDING).limit(1)
            .get().await().documents.firstOrNull()?.toAlert()
    }.getOrNull()

    private fun com.google.firebase.firestore.DocumentSnapshot.toAlert() = GroupAlert(
        id, getString("problem").orEmpty(), getString("area"), (getLong("count") ?: 0).toInt(), getString("message").orEmpty(),
        getTimestamp("createdAt")?.toDate()?.time ?: System.currentTimeMillis(),
    )

    companion object {
        private const val KEY = "group"
        /** However it's typed: " 7kq2mx " or "G-7KQ2MX" → "g-7KQ2MX" (web: normalizeCode). */
        fun normalizeCode(input: String) = "g-" + input.uppercase().removePrefix("G-").filter { it in 'A'..'Z' || it in '0'..'9' }
        /** A square about 5 km across (web: coarseCell). */
        fun coarseCell(lat: Double, lng: Double): String {
            fun r(x: Double) = "%.2f".format(java.util.Locale.ROOT, Math.round(x * 20) / 20.0)
            return "${r(lat)},${r(lng)}"
        }
    }
}

/**
 * An officer's confirmed alert in the reader's own language, from its stored problem, area and
 * count (web: ui/alertText.ts). [t] is the i18n lookup for the reader's language.
 */
fun alertText(t: (String, Array<Pair<String, Any>>) -> String, problemName: (String) -> String, a: GroupAlert): String {
    val area = a.area?.ifBlank { null } ?: t("area.noArea", emptyArray())
    val problem = problemName(a.problem)
    return if (a.count == 1) t("area.alertMessageOne", arrayOf("problem" to problem, "area" to area))
    else t("area.alertMessage", arrayOf("problem" to problem, "n" to a.count, "area" to area))
}
