# Maize guide photo completion — 26 November 2026

All 28 maize references now resolve to a bundled photograph, including the six version 4 additions. These assets are included in the web precache and Android shared assets; no remote image is required while reading the guide offline.

The new references use the following real photographs. No disease features were generated or retouched. The seedling and root entries display distinct field photographs (panels a and b) from the same published figure. Its complete photographic content is retained in the bundled JPEG, with the panel selected in the web viewport and during Android bitmap decoding. The publisher PNG was converted to a maximum 1800-pixel JPEG for offline download size.

| Guide reference | Source and subject | Author / permission |
| --- | --- | --- |
| `herbicide_injury` | [Corn with clomazone direct-application injury](https://plants.uada.edu/herbicide/view/?type=plant&group=Corn) | Cal Shumway, Bob Scott and John Boyd, University of Arkansas Division of Agriculture · [Reuse permitted](https://plants.uada.edu/herbicide/select/) |
| `hail_wind_damage` | [Hail damage on a maize leaf](https://commons.wikimedia.org/wiki/File:Hagelschaden-Maisblatt.jpg) | Zumthie · [Public domain](https://commons.wikimedia.org/wiki/File:Hagelschaden-Maisblatt.jpg#Licensing) |
| `cold_frost_injury` | [Freezing injury on field corn — Bugwood 5363636](https://www.ipmimages.org/browse/image/5363636) | Howard F. Schwartz, Colorado State University, Bugwood.org · [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/) |
| `seedling_disease` | [Fusarium symptoms on maize seedling — Figure 1a](https://www.mdpi.com/2223-7747/12/22/3857#fig_body_display_plants-12-03857-f001) | Martina Sanna, Ilaria Martino, Vladimiro Guarnaccia and Monica Mezzalama (2023), Plants 12:3857 · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `root_rot` | [Fusarium symptoms on maize roots and crown — Figure 1b](https://www.mdpi.com/2223-7747/12/22/3857#fig_body_display_plants-12-03857-f001) | Martina Sanna, Ilaria Martino, Vladimiro Guarnaccia and Monica Mezzalama (2023), Plants 12:3857 · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `stalk_rot` | [Anthracnose on maize stalk sections — Bugwood 5608094](https://www.ipmimages.org/browse/image/5608094) | Adam Sisson, Iowa State University, Bugwood.org · [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/) |

## Source checks

- UADA explicitly states that photographs in its herbicide injury database are not copyrighted and may be reused, with attribution to its authors. The maize gallery labels the chosen photograph as corn with clomazone exposure. The app provides the requested collection credit and source link.
- The Commons hail photograph is identified as hail injury on a maize leaf and released into the public domain by Zumthie.
- Bugwood's individual catalogue metadata identifies maize as host for image 5363636 (freezing damage; Howard F. Schwartz) and 5608094 (anthracnose; Adam Sisson, Iowa State University). Their image-level commercial flags are both 2; the catalogue links both to CC BY 3.0 US. Noncommercial-only candidates were excluded. The embedded catalogue image numbers remain visible. These specific image licences are linked directly beside the credits.
- Sanna et al., Plants (2023), DOI 10.3390/plants12223857, is published under CC BY 4.0. Figure 1 identifies panels a and b as field symptoms associated with Fusarium on maize seedlings and roots/crowns. Panels c and d show experimental inoculation; those were not selected. The credits name all four authors, publication and licence, and link to the original figure.

## Limits

These are source-checked visual examples, not agronomist confirmation of the app's diagnoses. The freeze image shows mature maize; the herbicide image shows one chemical-injury pattern; the hail image shows leaf injury; the stalk image shows an anthracnose-associated example, including dark outer stalk discolouration; the published field photographs show a Fusarium-associated seedling/root example. Each broad guide reference includes other look-alikes. A photograph cannot identify every pathogen, prove grain safety or replace a field or laboratory assessment.

All image credit records keep `confirmed: false`. Agronomic/native-speaker review of reference text and independent diagnostic accuracy measurement remain pending. The six new reference texts still use disclosed English fallback. Photo availability is now complete; these other limitations are unchanged.

## Bundled asset integrity

- `cold_frost_injury.jpg`: 94,367 bytes; SHA-256 `092151359d944865b7e1e066af266ce8f80c662152c0824ce7781cd0e8519838`.
- `fusarium_seedling_root.jpg`: 859,122 bytes; SHA-256 `2b42f90627f7cb17685dae9cc7fb7557457776f2ade213c0d8ca3f65cf307593`.
- `hail_wind_damage.jpg`: 517,507 bytes; SHA-256 `7f024a9af0e0de3fd65a73d2b456dcd2c39d4d6bc35c296a242cce49bfc4779f`.
- `herbicide_injury.jpg`: 202,319 bytes; SHA-256 `d8c47c52dccd4b129de8ca56858837e90b51cae2eebf4d905a21924b4bd211b6`.
- `stalk_rot.jpg`: 223,347 bytes; SHA-256 `0287fc3eb55e4bd248c57d09086b1eba522fd75067bc9fac1e2d1e8bcb2fe9e9`.

## Verification

Web: 196 tests passed across 28 files; production build passed. Android: debug Kotlin compilation and 78 unit tests passed. Browser checks at 390 × 844 verified all six images decode at suitable resolution, attribution/licence/source links, distinct published panels and no horizontal overflow; the guide contains 28 photo references with no placeholders. On the deployed Firebase site, all five unique new assets were present in the service-worker precache, and all six photo references decoded while browser networking was disabled. Evidence is stored under `docs/evidence/2026-11-26/maize-six-photos-mobile.json` and `maize-six-photos-offline.json`. This verifies image delivery, not diagnostic accuracy.

## Stalk photograph replacement

Replaced the extreme macro photograph (Bugwood 1436022) with Bugwood 5608094 after user feedback. The new, unretouched photograph shows recognisable stalk sections and outer discolouration. Caption and credit now describe anthracnose rather than Fusarium. Previous six-photo screenshots remain historical evidence of the initial photo set.
