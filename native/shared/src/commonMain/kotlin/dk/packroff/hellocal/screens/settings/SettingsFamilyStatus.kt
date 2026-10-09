package dk.packroff.hellocal.screens.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import kotlinx.serialization.Serializable

// GET /api/family — same shape as FamilyStatus in
// src/components/family/FamilyStatusProvider.tsx (docs/FAMILY.md).

@Serializable
data class FamilyProfile(val id: String, val displayName: String = "", val isChild: Boolean = false, val canWrite: Boolean = false)

@Serializable
data class FamilyMemberInfo(
    val userId: String,
    val displayName: String = "",
    val isChild: Boolean = false,
    val age: Int? = null,
    val hasLogin: Boolean = false,
    val createdByOwner: Boolean = false,
    val controllerId: String = "",
    val canDeleteOthersEntries: Boolean = false,
)

@Serializable
data class FamilyMe(val id: String, val displayName: String = "")

@Serializable
data class FamilyInfo(
    val id: String,
    val ownerId: String = "",
    val ownerName: String = "",
    val isOwner: Boolean = false,
    val members: List<FamilyMemberInfo> = emptyList(),
)

@Serializable
data class FamilyStatus(
    val me: FamilyMe,
    val activeProfile: FamilyProfile? = null,
    val profiles: List<FamilyProfile> = emptyList(),
    val family: FamilyInfo? = null,
    val hasFamilyPlan: Boolean = false,
    val maxProfiles: Int = 0,
    val unseenCount: Int = 0,
)

/** Loads /api/family once per screen (web: useFamilyStatus()). Null until loaded or on error. */
@Composable
fun rememberFamilyStatus(reloadKey: Any? = Unit): FamilyStatus? {
    var status by remember { mutableStateOf<FamilyStatus?>(null) }
    LaunchedEffect(reloadKey) {
        status = runCatching { ApiJson.decodeFromJsonElement(FamilyStatus.serializer(), Api.get("/api/family")) }.getOrNull() ?: status
    }
    return status
}

suspend fun loadFamilyStatus(): FamilyStatus? =
    runCatching { ApiJson.decodeFromJsonElement(FamilyStatus.serializer(), Api.get("/api/family")) }.getOrNull()
