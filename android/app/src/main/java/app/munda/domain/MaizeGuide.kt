package app.munda.domain

/**
 * Embedded so it works offline. The on-device model only accepts ~4k tokens, so we send it the
 * few entries that match the observation ([relevant]); the cloud review gets the whole guide.
 */
object MaizeGuide : SymptomGuide {

    override val crop = Crop.MAIZE

    override val entries: List<GuideEntry> = listOf(
        GuideEntry(
            "nitrogen", "Nitrogen deficiency", GuideCategory.NUTRIENT,
            listOf("yellow", "yellowing", "pale", "light green", "lower leaves", "bottom leaves", "old leaves", "v shape", "v-shape", "midrib", "tip", "stunted", "poor growth", "small", "thin"),
            "Yellowing starts at the tip of older, lower leaves and runs down the midrib in a V shape; plants pale and stunted.",
            "Lower leaves first (sulfur and zinc show on young leaves first). Common after heavy rain on sandy soil or with no top-dressing.",
            "Compare lower and upper leaves; ask when fertilizer was last applied; compare with a well-fertilized row.",
        ),
        GuideEntry(
            "waterlogging", "Waterlogging", GuideCategory.WATER,
            listOf("waterlogged", "standing water", "flood", "flooded", "wet", "low", "low spots", "puddle", "rain", "yellow", "purple", "wilting", "rotten roots", "smell"),
            "Yellowing or purpling and stunting in low parts of the field after heavy rain; roots brown, few, or smelling sour.",
            "Follows the lie of the land (low spots) rather than rows or random plants; appears within days of heavy rain.",
            "Look for standing water or wet soil after rain; dig up one plant and check roots for brown rot or sour smell.",
        ),
        GuideEntry(
            "drought", "Drought / moisture stress", GuideCategory.WATER,
            listOf("dry", "drought", "no rain", "rolling", "rolled", "curling", "wilting", "grey", "gray", "dull", "afternoon", "hot", "cracks"),
            "Leaves roll or curl and look dull grey-green, especially in the afternoon; plants recover overnight if stress is mild.",
            "Rolling that eases in the morning points to moisture stress; worst on sandy or shallow soils and ridges.",
            "Dig 10 cm down: if soil crumbles dry, moisture is short. Check whether leaves unroll early morning.",
        ),
        GuideEntry(
            "sulfur", "Sulfur deficiency", GuideCategory.NUTRIENT,
            listOf("yellow", "striped", "stripes", "young leaves", "top leaves", "upper leaves", "new leaves", "pale"),
            "Whole young (upper) leaves turn pale yellow, sometimes with light stripes between veins; plants stunted.",
            "Upper/younger leaves first — the opposite of nitrogen, which starts on lower leaves.",
            "Compare young top leaves with older lower ones. Common on sandy, low-organic-matter soils.",
        ),
        GuideEntry(
            "potassium", "Potassium deficiency", GuideCategory.NUTRIENT,
            listOf("edges", "margins", "brown edges", "burnt", "scorched", "firing", "lower leaves", "lodging", "falling over"),
            "Older leaves yellow then brown along the edges (margins) while the midrib stays green; weak stalks may fall over.",
            "Edges burn, not the midrib (nitrogen runs down the midrib).",
            "Look at lower leaf edges for yellow-brown scorching with a green centre.",
        ),
        GuideEntry(
            "phosphorus", "Phosphorus deficiency", GuideCategory.NUTRIENT,
            listOf("purple", "reddish", "red", "dark green", "slow", "young plants", "cold", "stunted"),
            "Young plants dark green with purple or reddish leaf edges and tips; slow early growth.",
            "Mostly in young plants and cold or wet early-season soils; some varieties are naturally purple.",
            "Check whether purple colour is on young plants across an area; compare with plants of the same seed elsewhere.",
        ),
        GuideEntry(
            "zinc", "Zinc deficiency", GuideCategory.NUTRIENT,
            listOf("white", "bands", "white stripes", "young leaves", "pale bands", "short", "bushy"),
            "Broad white or pale yellow bands either side of the midrib on young leaves; short internodes.",
            "Wide bands near the base of young leaves, not narrow broken streaks (streak virus).",
            "Examine young leaves for broad pale bands starting near the leaf base.",
        ),
        GuideEntry(
            "fall_armyworm", "Fall armyworm", GuideCategory.PEST,
            listOf("holes", "ragged", "eaten", "chewed", "window", "windowpane", "whorl", "funnel", "sawdust", "frass", "droppings", "caterpillar", "worm", "larva", "larvae"),
            "Ragged holes and see-through 'windowpane' patches on leaves; wet sawdust-like droppings (frass) in the whorl; caterpillars inside.",
            "Fresh frass in the whorl and a caterpillar with an upside-down Y on its head; damage on scattered plants, not in low spots.",
            "Walk a W pattern, check 20 plants: open the whorl, look for frass and caterpillars. Note how many of 20 are damaged.",
        ),
        GuideEntry(
            "stalk_borer", "Stalk borer", GuideCategory.PEST,
            listOf("holes", "shot holes", "row of holes", "dead heart", "dead centre", "tunnel", "stem", "stalk", "broken", "borer"),
            "Rows of small 'shot holes' across leaves as they unroll; dead centre leaf (dead heart); tunnels inside stems.",
            "Holes in a neat row across the leaf (from feeding in the whorl) and tunnels in the stalk.",
            "Pull the centre leaf: if it slides out and is rotten at the base, split the stem to look for tunnels or larvae.",
        ),
        GuideEntry(
            "streak_virus", "Maize streak virus", GuideCategory.DISEASE,
            listOf("streaks", "streak", "stripes", "lines", "yellow lines", "broken lines", "young leaves", "stunted", "leafhopper"),
            "Narrow, broken yellow streaks along the veins of young leaves, becoming continuous stripes; plants stunted if infected early.",
            "Thin broken streaks along veins (not broad bands); scattered plants, often near field edges; spread by leafhoppers.",
            "Hold a young leaf to the light and look for thin broken yellow streaks along veins. Count affected plants.",
        ),
        GuideEntry(
            "mln", "Maize lethal necrosis", GuideCategory.DISEASE,
            listOf("drying", "dying", "dead", "margins", "edges", "dead heart", "rotten cob", "mottle", "mottling", "whole plant"),
            "Yellow mottling, then drying from leaf edges inward; dead heart; plants may die or cobs rot. Recorded mainly in East Africa.",
            "Rapid drying of whole plants and dead heart with mottling; usually needs expert or lab confirmation.",
            "Note how many plants are drying from the edges and whether centre leaves are dead. Report to an extension officer.",
        ),
        GuideEntry(
            "grey_leaf_spot", "Grey leaf spot", GuideCategory.DISEASE,
            listOf("spots", "lesions", "grey", "gray", "tan", "rectangular", "brown spots", "humid", "lower leaves"),
            "Long, narrow rectangular grey to tan lesions that stop at the leaf veins, starting on lower leaves in humid weather.",
            "Straight-sided rectangles bounded by veins (blight lesions are cigar-shaped).",
            "Look at lower leaves for rectangular lesions with straight sides.",
        ),
        GuideEntry(
            "leaf_blight", "Northern leaf blight", GuideCategory.DISEASE,
            listOf("spots", "lesions", "long spots", "cigar", "boat", "grey-green", "tan", "dead patches", "humid", "cool"),
            "Long cigar- or boat-shaped grey-green to tan lesions on leaves, starting low and moving up in cool, humid weather.",
            "Elliptical, cigar-shaped lesions not limited by veins.",
            "Measure a few lesions: long (several cm) elliptical lesions suggest blight.",
        ),
        GuideEntry(
            "striga", "Striga (witchweed)", GuideCategory.WEED,
            listOf("weed", "weeds", "pink flowers", "purple flowers", "small plants", "witchweed", "striga", "wilting", "stunted", "yellow"),
            "Maize stunted, yellowing and wilting even with moisture, with small weeds with pink or purple flowers at the base.",
            "Small pink/purple-flowered weeds attached to maize roots; damage starts before the weed emerges.",
            "Look at the base of affected plants for small weeds with pink or purple flowers; carefully dig to see if they attach to roots.",
        ),
    )

    private val byId = entries.associateBy { it.id }
    private val index = KeywordIndex(entries)

    override fun get(id: String?): GuideEntry? = id?.let { byId[it] }

    /**
     * Cheap, deterministic, offline retrieval: keyword hits plus maize-specific context boosts
     * from the core answers.
     */
    override fun relevant(text: String, core: CoreAnswers, stage: CropStage, limit: Int): List<GuideEntry> {
        val scored = entries.map { e ->
            var score = index.score(e, text)
            when (e.id) {
                "waterlogging" -> {
                    if (core.rainfall.isHeavy) score += 2.0
                    if (core.area == AffectedArea.LOW_SPOTS) score += 3.0
                }
                "nitrogen" -> if (core.rainfall.isHeavy) score += 1.0 // leaching
                "drought" -> if (core.rainfall == Rainfall.NONE) score += 3.0 else if (core.rainfall.isHeavy) score -= 2.0
                "streak_virus" -> if (core.area == AffectedArea.FIELD_EDGES || core.area == AffectedArea.FEW_PLANTS) score += 0.5
                "phosphorus" -> if (stage == CropStage.EMERGENCE || stage == CropStage.EARLY_GROWTH) score += 0.5
                "fall_armyworm" -> if (stage == CropStage.EARLY_GROWTH || stage == CropStage.LATE_GROWTH) score += 0.5
            }
            e to score
        }
        return scored.sortedByDescending { it.second }.take(limit.coerceAtLeast(MIN_RESULTS)).map { it.first }
    }

    private const val MIN_RESULTS = 3
}
