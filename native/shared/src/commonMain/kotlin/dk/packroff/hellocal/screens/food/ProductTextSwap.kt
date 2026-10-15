package dk.packroff.hellocal.screens.food

import kotlinx.serialization.Serializable

// Native port of src/lib/product-text-swap.ts: "Vis original" on the product
// page (docs/DECISIONS.md 2026-10-15). GET /api/products/[id] sends the shown
// text in the fields and the other version (original or translation) in
// translation.alternate; swapping needs no new request.

@Serializable
data class ProductTranslationInfo(
    /** "translated" | "original" — what the fields show right now. */
    val showing: String = "translated",
    val sourceLanguageName: String? = null,
    val targetLanguageName: String = "",
    /** The other version of the same fields ("brand" = the brand's name). */
    val alternate: Map<String, String?> = emptyMap(),
    /** "title" | "ingredients" — where the note sits: above the ingredients when only they are translated. */
    val placement: String = "title",
)

private fun ProductDto.text(key: String): String? = when (key) {
    "name" -> name
    "productType" -> productType
    "variant" -> variant
    "packageSizeText" -> packageSizeText
    "ingredientsText" -> ingredientsText
    "subbrand" -> subbrand
    "brand" -> brand?.name
    else -> null
}

private fun ProductDto.withText(key: String, value: String?): ProductDto = when (key) {
    "name" -> copy(name = value ?: "")
    "productType" -> copy(productType = value)
    "variant" -> copy(variant = value)
    "packageSizeText" -> copy(packageSizeText = value)
    "ingredientsText" -> copy(ingredientsText = value)
    "subbrand" -> copy(subbrand = value)
    "brand" -> if (brand != null && value != null) copy(brand = brand.copy(name = value)) else this
    else -> this
}

/** Shows the other version: the fields and translation.alternate change places. */
fun swapProductTexts(product: ProductDto): ProductDto {
    val translation = product.translation ?: return product
    val current = translation.alternate.keys.associateWith { product.text(it) }
    val swapped = translation.alternate.entries.fold(product) { acc, (key, value) -> acc.withText(key, value) }
    return swapped.copy(
        translation = translation.copy(
            showing = if (translation.showing == "translated") "original" else "translated",
            alternate = current,
        ),
    )
}

/** The user's "Vis original"/"Vis oversættelse" choice applied to a freshly fetched product. */
fun withTextChoice(product: ProductDto, choice: String?): ProductDto {
    val translation = product.translation ?: return product
    return if (choice == null || choice == translation.showing) product else swapProductTexts(product)
}
