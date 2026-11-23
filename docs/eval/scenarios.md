# Evaluation scenarios

Two layers of evaluation:

1. **Retrieval (automated, offline):** `MaizeGuideRetrievalTest` checks that, for each scenario, the expected causes reach the on-device prompt. If retrieval misses a cause, the model can't weigh it.
2. **Model output (manual, on real devices):** run each scenario in the app: once on-device (MacBook Chrome, Wi-Fi off) and once in cloud mode (iPhone or Wi-Fi on with on-device AI unavailable), and score it with the checklist below.

## Scoring checklist (per run)

| Check | Pass if |
|---|---|
| Expected cause listed | At least one "expected" cause appears in the possible causes |
| Calibrated | No cause is "Likely" unless the description clearly supports it with 2+ signs |
| Evidence is real | Every "fits what you saw" item was actually said by the farmer |
| Gaps are honest | "Doesn't fit / still unknown" names a real missing fact |
| Checks are doable | Every "check next" can be done with eyes and hands in the field |
| No overreach | No product names, doses or certainty language ("your crop has…") |
| Questions discriminate | AI follow-up questions would help separate the expected causes |

Target before filming: **at least 8 of 10 scenarios passing every check on-device.** Record failures in the table at the bottom and send them back for prompt or guide tuning.

## Scenarios

| # | Farmer says | Core answers (area / rain / onset) | Expected causes | Good follow-up question |
|---|---|---|---|---|
| 1 | Lower leaves are yellowing from the tip down the middle and the plants are not growing well | Patches / Heavy / This week | Nitrogen deficiency, Waterlogging | "Is the soil wet or waterlogged where it's worst?" |
| 2 | Maize is yellow and small in some places | Low-lying spots / Flooding / 1–2 weeks | Waterlogging, Nitrogen deficiency | "Do the roots look brown or smell sour?" |
| 3 | Ragged holes in the leaves and something like sawdust inside the funnel | Patches / Light / This week | Fall armyworm (Stalk borer less likely) | "Can you see caterpillars inside the whorl?" |
| 4 | Leaves are rolling and look grey in the afternoon | Most of field / No rain / This week | Drought stress | "Do the leaves unroll in the early morning?" |
| 5 | Young leaves have thin broken yellow streaks along the lines and plants are stunted | Field edges / Light / 1–2 weeks | Maize streak virus (Zinc less likely) | "Are the streaks thin lines along the veins, or wide bands?" |
| 6 | The young plants are purple on the edges and growing slowly | Patches / Light / This week, stage Emergence | Phosphorus deficiency | "Are all plants of the same seed purple, or only some areas?" |
| 7 | Older leaves have brown burnt edges but the middle is green | Patches / Light / Longer | Potassium deficiency | "Are the stalks weak or falling over?" |
| 8 | Grey rectangular spots on the lower leaves, very humid this week | Patches / Heavy / This week | Grey leaf spot (Northern leaf blight less likely) | "Do the spots have straight sides along the veins?" |
| 9 | Maize is wilting and yellow even though soil is wet, small weeds with pink flowers at the base | Patches / Light / Longer | Striga | "Are the small weeds attached to the maize roots?" |
| 10 | The new top leaves are pale yellow with stripes, bottom leaves look fine | Most of field / Light / 1–2 weeks | Sulfur deficiency (Zinc possible) | "Are the stripes wide bands near the leaf base?" |

## History scenario (for the cloud review demo)

Record these on the **same plot** across several days (dates can be close together; the rules use a 120-day lookback):

1. Scenario 2 (yellow in low spots after flooding), area "Low-lying spots"
2. A few days later: scenario 1 with rain "Heavy", area "Patches"
3. Today: scenario 1 again with area "Most of the field" and rain "Heavy"

Expected on reconnect: **Getting worse** (area grew), **Linked to rain** (repeated after heavy rain), and **Keeps coming back** (same likely cause again). The cloud review should raise drainage and leaching as the next things to check.

Optionally record scenario 3 on two *other* plots within 21 days to trigger **Spreading to other plots**.

## Results log

| Date | Scenario | Mode | Pass? | Notes |
|---|---|---|---|---|
| | | | | |
