package app.munda.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import app.munda.domain.*
import app.munda.i18n.I18n

/** The farmer's language bound to the shared text; screens read it with `strings()`. */
class Strings(val i18n: I18n, val lang: String) {
    fun t(key: String, vararg vars: Pair<String, Any>) = i18n.t(lang, key, *vars)
    fun area(a: AffectedArea) = t("enums.area.${a.name}")
    fun rain(r: Rainfall) = t("enums.rain.${r.name}")
    fun onset(o: Onset) = t("enums.onset.${o.name}")
    fun stage(s: CropStage) = t("enums.stage.${s.name}")
    fun likelihood(l: Likelihood) = t("enums.likelihood.${l.name}")
    fun urgency(u: Urgency) = t("enums.urgency.${u.name}")
    fun origin(o: InferenceOrigin) = t("enums.origin.${o.name}")
    fun pattern(p: PatternKind) = t("enums.pattern.${p.name}")
    fun source(s: FindingSource) = t("enums.source.${s.name}")
    fun plotStatus(s: PlotStatus) = t("enums.plotStatus.${s.name}")
    fun weekday(day: Int) = i18n.weekday(lang, day)
    fun shortDate(ms: Long) = i18n.shortDate(lang, ms)
    fun date(ms: Long) = i18n.formatDate(lang, ms)
    fun ago(ms: Long, now: Long = System.currentTimeMillis()) = i18n.relativeTime(lang, ms, now)
    /** English name of the language, for the cloud prompt line. */
    val english get() = i18n.info(lang).english
}

val LocalStrings = staticCompositionLocalOf<Strings> { error("Strings not provided") }

@Composable
fun strings(): Strings = LocalStrings.current
