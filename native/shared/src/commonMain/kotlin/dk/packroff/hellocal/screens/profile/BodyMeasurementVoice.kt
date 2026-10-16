package dk.packroff.hellocal.screens.profile

import kotlin.math.max
import kotlin.math.roundToInt

/*
 * Native port of src/lib/body-measurement-voice.ts — the voice guide on
 * Kropsmål: it asks for one measurement at a time, says where to measure,
 * listens for the number, says it back and moves on. It can ONLY fill the
 * body-measurement fields: numbers plus five commands (skip, back, repeat,
 * stop) and nothing else. Keep the two files in step.
 */

sealed interface VoiceCommand {
    data class Value(val value: Double) : VoiceCommand
    data object Skip : VoiceCommand
    data object Back : VoiceCommand
    data object Repeat : VoiceCommand
    data object Stop : VoiceCommand
    data object Unknown : VoiceCommand
}

/** A sentence the guide says: an i18n key under bodyMeasurements.voice + parameters. */
data class VoiceLine(val key: String, val field: String? = null, val value: Double? = null)

data class GuideState(val fields: List<String>, val index: Int, val misses: Int = 0)

data class GuideSave(val field: String, val value: Double)

data class GuideStep(val state: GuideState, val say: List<VoiceLine>, val done: Boolean, val save: GuideSave? = null)

object BodyMeasurementVoice {
    private val stopWords = listOf(
        "stop", "stoppe", "afslut", "slut", "færdig", "luk", "annuller",
        "finish", "done", "quit", "cancel", "end",
        "stopp", "avsluta", "klar", "avslutt", "ferdig",
        "beenden", "fertig", "abbrechen", "arrête", "arrêter", "terminé", "fini", "klaar", "einde",
    )
    private val skipWords = listOf(
        "spring over", "spring", "næste", "videre", "ved ikke", "skip", "next", "pass",
        "hoppa över", "hoppa", "nästa", "hopp over", "neste", "vet ikke", "vet inte",
        "überspringen", "weiter", "nächste", "passer", "suivant", "overslaan", "volgende",
    )
    private val backWords = listOf(
        "tilbage", "forrige", "back", "previous", "go back", "tillbaka", "föregående",
        "zurück", "retour", "précédent", "terug", "vorige",
    )
    private val repeatWords = listOf(
        "gentag", "igen", "hvad", "hvordan", "repeat", "again", "what", "how",
        "upprepa", "gjenta", "hva", "wiederholen", "nochmal", "wie", "répète", "répéter",
        "comment", "herhaal", "opnieuw", "hoe",
    )

    private val units = mapOf(
        "nul" to 0, "zero" to 0, "en" to 1, "et" to 1, "one" to 1, "to" to 2, "two" to 2, "tre" to 3, "three" to 3,
        "fire" to 4, "four" to 4, "fem" to 5, "five" to 5, "seks" to 6, "six" to 6, "syv" to 7, "seven" to 7,
        "otte" to 8, "eight" to 8, "ni" to 9, "nine" to 9, "ti" to 10, "ten" to 10, "elleve" to 11, "eleven" to 11,
        "tolv" to 12, "twelve" to 12, "tretten" to 13, "thirteen" to 13, "fjorten" to 14, "fourteen" to 14,
        "femten" to 15, "fifteen" to 15, "seksten" to 16, "sixteen" to 16, "sytten" to 17, "seventeen" to 17,
        "atten" to 18, "eighteen" to 18, "nitten" to 19, "nineteen" to 19,
    )
    private val tens = mapOf(
        "tyve" to 20, "twenty" to 20, "tredive" to 30, "thirty" to 30, "fyrre" to 40, "forty" to 40,
        "halvtreds" to 50, "fifty" to 50, "tres" to 60, "sixty" to 60, "halvfjerds" to 70, "seventy" to 70,
        "firs" to 80, "eighty" to 80, "halvfems" to 90, "ninety" to 90,
    )
    private val hundred = setOf("hundrede", "hundred")
    private val decimalWords = setOf("komma", "punkt", "point", "comma", "dot", "koma", "virgule", "punt")
    private val halfPatterns = listOf(
        Regex("\\bog en halv\\b"), Regex("\\bog et halvt\\b"), Regex("\\band a half\\b"), Regex("\\bhalvanden\\b"),
    )
    private val fillerWords = Regex(
        "^(cm|centimeter|centimetre|centimeters|centimetres|tommer|tomme|inch|inches|in|zoll|pouces|duim|det|er|it|is|its|it's|jeg|har|i|målte|measured|ca|cirka|about|omkring|lige|præcis|exactly)$",
    )
    private val digits = Regex("^\\d+$")
    private val decimalNumber = Regex("^\\d+([.,]\\d+)?$")

    private fun normalize(text: String): String = text
        .lowercase()
        .replace(Regex("[!?;:\"'()]"), " ")
        .replace(Regex("(\\d)\\s*([.,])\\s*(\\d)"), "$1$2$3")
        .replace(Regex("[.,](\\s|$)"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun hasPhrase(text: String, phrase: String): Boolean =
        Regex("(^|\\s)${Regex.escape(phrase)}(\\s|$)").containsMatchIn(text)

    private fun splitDanishCompounds(text: String): String =
        text.replace(
            Regex("\\b(en|et|to|tre|fire|fem|seks|syv|otte|ni)og(tyve|tredive|fyrre|halvtreds|tres|halvfjerds|firs|halvfems)\\b"),
            "$1 og $2",
        )

    private fun wordsToNumber(words: List<String>): Int? {
        var total = 0
        var current = 0
        var seen = false
        for (word in words) {
            if (word == "og" || word == "and" || word == "-") continue
            when {
                word in units -> { current += units.getValue(word); seen = true }
                word in tens -> { current += tens.getValue(word); seen = true }
                word in hundred -> { total += (if (current == 0) 1 else current) * 100; current = 0; seen = true }
                digits.matches(word) && !seen -> { current += word.toInt(); seen = true }
                else -> return null
            }
        }
        return if (seen) total + current else null
    }

    private fun toNumber(word: String): Double = word.replace(",", ".").toDouble()

    /** The number in what was said (cm or inches), or null. */
    fun parseSpokenNumber(raw: String): Double? {
        var text = splitDanishCompounds(normalize(raw))
        val half = if (halfPatterns.any { it.containsMatchIn(text) }) 0.5 else 0.0
        halfPatterns.forEach { text = text.replace(it, " ") }
        text = text.replace(Regex("[-–]"), " ").replace(Regex("\\s+"), " ").trim()
        val words = text.split(" ").filter { it.isNotEmpty() && !fillerWords.matches(it) }

        val decimalAt = words.indexOfFirst { it in decimalWords }
        if (decimalAt > 0) {
            val whole = wordsToNumber(words.subList(0, decimalAt))
            val fractionWords = words.subList(decimalAt + 1, words.size)
            val fraction = if (fractionWords.size == 1 && digits.matches(fractionWords[0])) {
                "0.${fractionWords[0]}".toDouble()
            } else {
                wordsToNumber(fractionWords)?.let { "0.$it".toDouble() }
            }
            if (whole != null && fraction != null) return whole + fraction
        }

        val digitWords = words.filter { decimalNumber.matches(it) }
        if (digitWords.size == 1 && words.size == 1) return toNumber(digitWords[0]) + half
        if (digitWords.size == 1) {
            val rest = words.filter { it != digitWords[0] }
            if (wordsToNumber(rest) == null) return toNumber(digitWords[0]) + half
        }

        return wordsToNumber(words)?.let { it + half }
    }

    /** What the user meant: a number or one of the five commands. */
    fun interpret(raw: String?): VoiceCommand {
        val text = normalize(raw ?: "")
        if (text.isEmpty()) return VoiceCommand.Unknown
        parseSpokenNumber(text)?.let { return VoiceCommand.Value((it * 10).roundToInt() / 10.0) }
        return when {
            stopWords.any { hasPhrase(text, it) } -> VoiceCommand.Stop
            skipWords.any { hasPhrase(text, it) } -> VoiceCommand.Skip
            backWords.any { hasPhrase(text, it) } -> VoiceCommand.Back
            repeatWords.any { hasPhrase(text, it) } -> VoiceCommand.Repeat
            else -> VoiceCommand.Unknown
        }
    }

    /** A body measurement of 5–250 cm (2–100 inches) — anything else was misheard. */
    fun isPlausible(value: Double, inches: Boolean): Boolean =
        if (inches) value in 2.0..100.0 else value in 5.0..250.0

    /** Where the guide starts: the first measurement without today's number, else the first. */
    fun firstIndex(fields: List<String>, filled: (String) -> Boolean): Int =
        fields.indexOfFirst { !filled(it) }.let { if (it < 0) 0 else it }

    private fun ask(field: String) = listOf(VoiceLine("ask", field), VoiceLine("how.$field"))

    fun start(fields: List<String>, index: Int): GuideStep {
        val state = GuideState(fields, index)
        if (fields.isEmpty()) return GuideStep(state, listOf(VoiceLine("noFields")), done = true)
        return GuideStep(state, listOf(VoiceLine("intro")) + ask(fields[index]), done = false)
    }

    /** The next step after what the user said (null = nothing heard). */
    fun step(state: GuideState, heard: String?, inches: Boolean): GuideStep {
        val field = state.fields[state.index]
        val command = interpret(heard)
        if (command == VoiceCommand.Unknown) {
            val misses = state.misses + 1
            if (misses >= 3) return GuideStep(state.copy(misses = misses), listOf(VoiceLine("giveUp")), done = true)
            val key = if (heard.isNullOrBlank()) "notHeard" else "notUnderstood"
            return GuideStep(state.copy(misses = misses), listOf(VoiceLine(key, field)), done = false)
        }
        val reset = state.copy(misses = 0)
        return when (command) {
            VoiceCommand.Stop -> GuideStep(reset, listOf(VoiceLine("stopped")), done = true)
            VoiceCommand.Repeat -> GuideStep(reset, ask(field), done = false)
            VoiceCommand.Back -> {
                val index = max(0, state.index - 1)
                GuideStep(reset.copy(index = index), ask(state.fields[index]), done = false)
            }
            VoiceCommand.Skip -> {
                val index = state.index + 1
                if (index >= state.fields.size) {
                    GuideStep(reset.copy(index = index), listOf(VoiceLine("skipped"), VoiceLine("done")), done = true)
                } else {
                    GuideStep(reset.copy(index = index), listOf(VoiceLine("skipped")) + ask(state.fields[index]), done = false)
                }
            }
            is VoiceCommand.Value -> {
                if (!isPlausible(command.value, inches)) {
                    GuideStep(reset, listOf(VoiceLine("outOfRange", field, command.value)), done = false)
                } else {
                    val save = GuideSave(field, command.value)
                    val index = state.index + 1
                    val recorded = VoiceLine("recorded", value = command.value)
                    if (index >= state.fields.size) {
                        GuideStep(reset.copy(index = index), listOf(recorded, VoiceLine("done")), done = true, save = save)
                    } else {
                        val next = state.fields[index]
                        GuideStep(reset.copy(index = index), listOf(recorded, VoiceLine("next", next), VoiceLine("how.$next")), done = false, save = save)
                    }
                }
            }
            VoiceCommand.Unknown -> GuideStep(state, emptyList(), done = false)
        }
    }

    /** BCP-47 tag for speech in and out in the app's language. */
    fun languageTag(locale: String): String = when (locale) {
        "en" -> "en-GB"
        "sv" -> "sv-SE"
        "no" -> "nb-NO"
        "de" -> "de-DE"
        "fr" -> "fr-FR"
        "nl" -> "nl-NL"
        else -> "da-DK"
    }

    /** The number as the voice says it: "82,5" in Danish, "82.5" in English. */
    fun spokenValue(value: Double, locale: String): String {
        val rounded = (value * 10).roundToInt()
        val text = if (rounded % 10 == 0) "${rounded / 10}" else "${rounded / 10}.${rounded % 10}"
        return if (locale == "en") text else text.replace(".", ",")
    }
}
