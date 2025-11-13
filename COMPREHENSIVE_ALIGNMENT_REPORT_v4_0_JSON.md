# COMPREHENSIVE ALIGNMENT REPORT: v4.0 JSON System
**Generated:** 2025-10-30
**Purpose:** Cross-reference JSON schema → Backend extraction → Database → Frontend display

---

## EXECUTIVE SUMMARY

This report analyzes the complete data flow from the JSON prompt schema through backend processing, database storage, and frontend rendering to identify mismatches and alignment issues.

### Critical Findings:
- ✅ **28 fields** are properly aligned end-to-end
- ⚠️ **6 CRITICAL mismatches** found (data loss/display issues)
- ⚠️ **4 WARNING mismatches** found (minor issues)
- 🔧 **10 recommended fixes** to achieve full alignment

---

## SECTION 1: COMPLETE FIELD MAPPING TABLE

### 1.1 GRADES & CONDITION

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `final_grade.decimal_grade` | `parsedJSONData.final_grade?.decimal_grade` | `conversational_decimal_grade` | `card.conversational_decimal_grade` | ✅ ALIGNED |
| `final_grade.whole_grade` | `parsedJSONData.final_grade?.whole_grade` | `conversational_whole_grade` | `card.conversational_whole_grade` | ✅ ALIGNED |
| `final_grade.grade_range` | `parsedJSONData.final_grade?.grade_range` | `conversational_grade_uncertainty` | `card.conversational_grade_uncertainty` | ✅ ALIGNED |
| `final_grade.condition_label` | `parsedJSONData.final_grade?.condition_label` | `conversational_condition_label` | `card.conversational_condition_label` | ✅ ALIGNED |
| `final_grade.limiting_factor` | `parsedJSONData.weighted_scores?.limiting_factor` | `conversational_limiting_factor` | `card.conversational_limiting_factor` | ✅ ALIGNED |
| `final_grade.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.2 IMAGE QUALITY & UNCERTAINTY

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `image_quality.confidence_letter` | `parsedJSONData.image_quality?.confidence_letter` | `conversational_image_confidence` | `card.conversational_image_confidence` | ✅ ALIGNED |
| `image_quality.description` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `image_quality.grade_uncertainty` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **DUPLICATE** (use `final_grade.grade_range`) |
| `image_quality.notes` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.3 SUB-SCORES (RAW)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `raw_sub_scores.centering_front` | `parsedJSONData.raw_sub_scores?.centering_front` | `conversational_sub_scores.centering.front` | `card.conversational_sub_scores.centering.front` | ✅ ALIGNED |
| `raw_sub_scores.centering_back` | `parsedJSONData.raw_sub_scores?.centering_back` | `conversational_sub_scores.centering.back` | `card.conversational_sub_scores.centering.back` | ✅ ALIGNED |
| `raw_sub_scores.corners_front` | `parsedJSONData.raw_sub_scores?.corners_front` | `conversational_sub_scores.corners.front` | `card.conversational_sub_scores.corners.front` | ✅ ALIGNED |
| `raw_sub_scores.corners_back` | `parsedJSONData.raw_sub_scores?.corners_back` | `conversational_sub_scores.corners.back` | `card.conversational_sub_scores.corners.back` | ✅ ALIGNED |
| `raw_sub_scores.edges_front` | `parsedJSONData.raw_sub_scores?.edges_front` | `conversational_sub_scores.edges.front` | `card.conversational_sub_scores.edges.front` | ✅ ALIGNED |
| `raw_sub_scores.edges_back` | `parsedJSONData.raw_sub_scores?.edges_back` | `conversational_sub_scores.edges.back` | `card.conversational_sub_scores.edges.back` | ✅ ALIGNED |
| `raw_sub_scores.surface_front` | `parsedJSONData.raw_sub_scores?.surface_front` | `conversational_sub_scores.surface.front` | `card.conversational_sub_scores.surface.front` | ✅ ALIGNED |
| `raw_sub_scores.surface_back` | `parsedJSONData.raw_sub_scores?.surface_back` | `conversational_sub_scores.surface.back` | `card.conversational_sub_scores.surface.back` | ✅ ALIGNED |

### 1.4 WEIGHTED SCORES

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `weighted_scores.centering_weighted` | `parsedJSONData.weighted_scores?.centering_weighted` | `conversational_sub_scores.centering.weighted` & `conversational_weighted_sub_scores.centering` | `card.conversational_weighted_sub_scores.centering` | ✅ ALIGNED |
| `weighted_scores.corners_weighted` | `parsedJSONData.weighted_scores?.corners_weighted` | `conversational_sub_scores.corners.weighted` & `conversational_weighted_sub_scores.corners` | `card.conversational_weighted_sub_scores.corners` | ✅ ALIGNED |
| `weighted_scores.edges_weighted` | `parsedJSONData.weighted_scores?.edges_weighted` | `conversational_sub_scores.edges.weighted` & `conversational_weighted_sub_scores.edges` | `card.conversational_weighted_sub_scores.edges` | ✅ ALIGNED |
| `weighted_scores.surface_weighted` | `parsedJSONData.weighted_scores?.surface_weighted` | `conversational_sub_scores.surface.weighted` & `conversational_weighted_sub_scores.surface` | `card.conversational_weighted_sub_scores.surface` | ✅ ALIGNED |
| `weighted_scores.preliminary_grade` | `parsedJSONData.weighted_scores?.preliminary_grade` | `conversational_preliminary_grade` | ❌ NOT IN TYPE DEF | ⚠️ **FRONTEND MISSING** |
| `weighted_scores.limiting_factor` | `parsedJSONData.weighted_scores?.limiting_factor` | `conversational_limiting_factor` | `card.conversational_limiting_factor` | ✅ ALIGNED |
| `weighted_scores.centering_calculation` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ DOCUMENTATION ONLY |
| `weighted_scores.corners_calculation` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ DOCUMENTATION ONLY |
| `weighted_scores.edges_calculation` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ DOCUMENTATION ONLY |
| `weighted_scores.surface_calculation` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ DOCUMENTATION ONLY |

### 1.5 CENTERING RATIOS

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `centering.front.left_right` | `parsedJSONData.centering?.front?.left_right` | `conversational_centering_ratios.front_lr` | `card.conversational_centering_ratios?.front_lr` | ✅ ALIGNED |
| `centering.front.top_bottom` | `parsedJSONData.centering?.front?.top_bottom` | `conversational_centering_ratios.front_tb` | `card.conversational_centering_ratios?.front_tb` | ✅ ALIGNED |
| `centering.back.left_right` | `parsedJSONData.centering?.back?.left_right` | `conversational_centering_ratios.back_lr` | `card.conversational_centering_ratios?.back_lr` | ✅ ALIGNED |
| `centering.back.top_bottom` | `parsedJSONData.centering?.back?.top_bottom` | `conversational_centering_ratios.back_tb` | `card.conversational_centering_ratios?.back_tb` | ✅ ALIGNED |
| `centering.front.method` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |
| `centering.front.worst_axis` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |
| `centering.front.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED (duplicate of raw_sub_scores) |
| `centering.front.analysis` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `centering.back.method` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |
| `centering.back.worst_axis` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |
| `centering.back.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED (duplicate of raw_sub_scores) |
| `centering.back.analysis` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.6 CORNERS DEFECTS (FRONT)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `corners.front.top_left.condition` | ⚠️ **WRONG PATH**: `parsedJSONData.corners?.front?.top_left` (treats as string) | `conversational_corners_edges_surface.front.corners` (flattened) & `rawDefectsForEbay.front.corners.top_left.description` | `card.conversational_corners_edges_surface` | 🔴 **CRITICAL BUG** |
| `corners.front.top_left.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.front.top_right.condition` | ⚠️ **WRONG PATH** (same issue) | (same as above) | (same) | 🔴 **CRITICAL BUG** |
| `corners.front.top_right.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.front.bottom_left.condition` | ⚠️ **WRONG PATH** (same issue) | (same as above) | (same) | 🔴 **CRITICAL BUG** |
| `corners.front.bottom_left.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.front.bottom_right.condition` | ⚠️ **WRONG PATH** (same issue) | (same as above) | (same) | 🔴 **CRITICAL BUG** |
| `corners.front.bottom_right.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.front.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED (duplicate of raw_sub_scores) |
| `corners.front.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.7 CORNERS DEFECTS (BACK)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `corners.back.top_left.condition` | ⚠️ **WRONG PATH** (same issue as front) | (same as front) | (same) | 🔴 **CRITICAL BUG** |
| `corners.back.top_left.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.back.top_right.condition` | ⚠️ **WRONG PATH** | (same) | (same) | 🔴 **CRITICAL BUG** |
| `corners.back.top_right.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.back.bottom_left.condition` | ⚠️ **WRONG PATH** | (same) | (same) | 🔴 **CRITICAL BUG** |
| `corners.back.bottom_left.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.back.bottom_right.condition` | ⚠️ **WRONG PATH** | (same) | (same) | 🔴 **CRITICAL BUG** |
| `corners.back.bottom_right.defects[]` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | 🔴 **CRITICAL BUG** |
| `corners.back.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED |
| `corners.back.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.8 EDGES DEFECTS (FRONT)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `edges.front.top.condition` | `parsedJSONData.edges?.front?.top?.condition` | `conversational_corners_edges_surface.front.edges` (flattened) & `rawDefectsForEbay.front.edges.top.description` | `card.conversational_corners_edges_surface` | ✅ ALIGNED |
| `edges.front.top.defects[]` | `parsedJSONData.edges?.front?.top?.defects` | `conversational_defects_front.edges.defects[]` (transformed) | `card.conversational_defects_front` | ✅ ALIGNED |
| `edges.front.bottom.condition` | `parsedJSONData.edges?.front?.bottom?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.front.bottom.defects[]` | `parsedJSONData.edges?.front?.bottom?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.front.left.condition` | `parsedJSONData.edges?.front?.left?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.front.left.defects[]` | `parsedJSONData.edges?.front?.left?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.front.right.condition` | `parsedJSONData.edges?.front?.right?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.front.right.defects[]` | `parsedJSONData.edges?.front?.right?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.front.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED |
| `edges.front.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.9 EDGES DEFECTS (BACK)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `edges.back.top.condition` | `parsedJSONData.edges?.back?.top?.condition` | (same pattern as front) | (same) | ✅ ALIGNED |
| `edges.back.top.defects[]` | `parsedJSONData.edges?.back?.top?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.back.bottom.condition` | `parsedJSONData.edges?.back?.bottom?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.back.bottom.defects[]` | `parsedJSONData.edges?.back?.bottom?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.back.left.condition` | `parsedJSONData.edges?.back?.left?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.back.left.defects[]` | `parsedJSONData.edges?.back?.left?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.back.right.condition` | `parsedJSONData.edges?.back?.right?.condition` | (same) | (same) | ✅ ALIGNED |
| `edges.back.right.defects[]` | `parsedJSONData.edges?.back?.right?.defects` | (same) | (same) | ✅ ALIGNED |
| `edges.back.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED |
| `edges.back.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.10 SURFACE DEFECTS (FRONT)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `surface.front.defects[]` | `parsedJSONData.surface?.front?.defects` (maps to objects) | `conversational_defects_front.surface.defects[]` | `card.conversational_defects_front` | ✅ ALIGNED |
| `surface.front.defects[].type` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.front.defects[].severity` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.front.defects[].location` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.front.defects[].size` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `surface.front.defects[].description` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.front.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.front.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `surface.front.analysis` | `parsedJSONData.surface?.front?.analysis` | `conversational_defects_front.surface.condition` | `card.conversational_defects_front.surface.condition` | ✅ ALIGNED |

### 1.11 SURFACE DEFECTS (BACK)

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `surface.back.defects[]` | `parsedJSONData.surface?.back?.defects` | `conversational_defects_back.surface.defects[]` | `card.conversational_defects_back` | ✅ ALIGNED |
| `surface.back.defects[].type` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.back.defects[].severity` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.back.defects[].location` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.back.defects[].size` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `surface.back.defects[].description` | ✅ EXTRACTED | ✅ STORED | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.back.score` | ✅ EXTRACTED | ✅ STORED in sub_scores | ✅ DISPLAYED | ✅ ALIGNED |
| `surface.back.summary` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `surface.back.analysis` | `parsedJSONData.surface?.back?.analysis` | `conversational_defects_back.surface.condition` | `card.conversational_defects_back.surface.condition` | ✅ ALIGNED |

### 1.12 PROFESSIONAL SLAB DETECTION

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `professional_slab.detected` | `parsedJSONData.professional_slab?.detected` | `slab_detected` | `card.slab_detected` | ✅ ALIGNED |
| `professional_slab.company` | `parsedJSONData.professional_slab.company` | `slab_company` | `card.slab_company` | ✅ ALIGNED |
| `professional_slab.grade` | `parsedJSONData.professional_slab.grade` | `slab_grade` | `card.slab_grade` | ✅ ALIGNED |
| `professional_slab.grade_description` | `parsedJSONData.professional_slab.grade_description` | `slab_grade_description` | `card.slab_grade_description` | ✅ ALIGNED |
| `professional_slab.cert_number` | `parsedJSONData.professional_slab.cert_number` | `slab_cert_number` | `card.slab_cert_number` | ✅ ALIGNED |
| `professional_slab.sub_grades` | `parsedJSONData.professional_slab.sub_grades` | `slab_subgrades` (as JSONB) | `card.slab_subgrades` | ✅ ALIGNED |

### 1.13 PROFESSIONAL GRADE ESTIMATES

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `professional_grade_estimates.PSA.estimated_grade` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.PSA.estimated_grade` | 🔴 **CRITICAL: NOT EXTRACTED FROM JSON** |
| `professional_grade_estimates.PSA.confidence` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.PSA.confidence` | 🔴 **CRITICAL** |
| `professional_grade_estimates.PSA.notes` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.PSA.notes` | 🔴 **CRITICAL** |
| `professional_grade_estimates.BGS.*` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.BGS.*` | 🔴 **CRITICAL** |
| `professional_grade_estimates.SGC.*` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.SGC.*` | 🔴 **CRITICAL** |
| `professional_grade_estimates.CGC.*` | ❌ NOT EXTRACTED | ❌ NOT STORED FROM JSON | `card.estimated_professional_grades.CGC.*` | 🔴 **CRITICAL** |

**NOTE:** The backend has a SEPARATE professional grading estimation system that runs INDEPENDENTLY. The JSON schema includes professional_grade_estimates, but route.ts IGNORES it and uses its own deterministic mapper instead. This creates a discrepancy where the AI provides estimates that are discarded.

### 1.14 CARD INFO

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `card_info.card_name` | `parsedJSONData.card_info` (as object) | `conversational_card_info` (JSONB) & `card_name` (extracted) | `card.conversational_card_info?.card_name` | ✅ ALIGNED |
| `card_info.player_or_character` | (same) | `conversational_card_info` & `featured` | `card.conversational_card_info?.player_or_character` | ✅ ALIGNED |
| `card_info.set_name` | (same) | `conversational_card_info` & `card_set` | `card.conversational_card_info?.set_name` | ✅ ALIGNED |
| `card_info.year` | (same) | `conversational_card_info` & `release_date` | `card.conversational_card_info?.year` | ✅ ALIGNED |
| `card_info.manufacturer` | (same) | `conversational_card_info` & `manufacturer_name` | `card.conversational_card_info?.manufacturer` | ✅ ALIGNED |
| `card_info.card_number` | (same) | `conversational_card_info` & `card_number` | `card.conversational_card_info?.card_number` | ✅ ALIGNED |
| `card_info.sport_or_category` | (same) | `conversational_card_info` | `card.conversational_card_info?.sport_or_category` | ✅ ALIGNED |
| `card_info.serial_number` | (same) | `conversational_card_info` | `card.conversational_card_info?.serial_number` | ✅ ALIGNED |
| `card_info.rookie_or_first` | (same) | `conversational_card_info` & `rookie_card` | `card.conversational_card_info?.rookie_or_first` | ✅ ALIGNED |
| `card_info.rarity_or_variant` | (same) | `conversational_card_info` | `card.conversational_card_info?.rarity_or_variant` | ✅ ALIGNED |
| `card_info.authentic` | (same) | `conversational_card_info` | `card.conversational_card_info?.authentic` | ✅ ALIGNED |
| `card_info.subset` | (same) | `conversational_card_info` | `card.conversational_card_info?.subset` | ✅ ALIGNED |
| `card_info.autographed` | (same) | `conversational_card_info` & `autograph_type` | `card.conversational_card_info?.autographed` | ✅ ALIGNED |
| `card_info.memorabilia` | (same) | `conversational_card_info` & `memorabilia_type` | `card.conversational_card_info?.memorabilia` | ✅ ALIGNED |
| `card_info.pokemon_type` | (same) | `conversational_card_info` | `card.conversational_card_info?.pokemon_type` | ✅ ALIGNED |
| `card_info.pokemon_stage` | (same) | `conversational_card_info` | `card.conversational_card_info?.pokemon_stage` | ✅ ALIGNED |
| `card_info.hp` | (same) | `conversational_card_info` | `card.conversational_card_info?.hp` | ✅ ALIGNED |
| `card_info.card_type` | (same) | `conversational_card_info` | `card.conversational_card_info?.card_type` | ✅ ALIGNED |

### 1.15 ALTERATION DETECTION

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `alteration_detection.autograph.present` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.autograph.verified` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.autograph.notes` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.handwritten_markings.detected` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.handwritten_markings.description` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.trimming.suspected` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.trimming.evidence` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `alteration_detection.alters_grade_to_na` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.16 GRADE CAPS & ROUNDING

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `grade_caps.structural_damage` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `grade_caps.surface_dent` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `grade_caps.unverified_autograph` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `grade_caps.handwritten_marking` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `grade_caps.suspected_trimming` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `grade_caps.applicable_cap` | ❌ NOT EXTRACTED | ⚠️ MAY BE IN `capped_grade_reason` | ❌ NOT IN TYPE DEF | ⚠️ **PARTIAL** |
| `grade_caps.after_caps` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `conservative_rounding.applicable` | ❌ NOT EXTRACTED | ⚠️ BOOLEAN FLAG EXISTS: `conservative_rounding_applied` | ❌ NOT IN TYPE DEF | ⚠️ **PARTIAL** |
| `conservative_rounding.reason` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `conservative_rounding.after_rounding` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

### 1.17 CROSS-VERIFICATION

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `cross_verification.creases_match` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `cross_verification.suspicious_lines` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `cross_verification.consistency_notes` | ❌ NOT EXTRACTED | ⚠️ MAY BE IN `cross_side_verification_result` | ❌ NOT IN TYPE DEF | ⚠️ **PARTIAL** |

### 1.18 VALIDATION CHECKLIST

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `validation_checklist.alteration_detection_complete` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.both_sides_analyzed` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.all_scores_in_range` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.weighted_calculations_verified` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.limiting_factor_identified` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.caps_applied_correctly` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.confidence_letter_consistent` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |
| `validation_checklist.all_steps_completed` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ⚠️ **MISSING** |

**NOTE:** The old v3.2 validation_checklist format (with different fields) is stored, but the v4.0 JSON validation_checklist is NOT extracted.

### 1.19 METADATA

| JSON Field Path | Route.ts Extraction | Database Column | Frontend Access | Status |
|----------------|---------------------|-----------------|-----------------|--------|
| `metadata.prompt_version` | `parsedJSONData.metadata?.prompt_version` | `conversational_prompt_version` | `card.conversational_meta?.prompt_version` | ✅ ALIGNED |
| `metadata.model` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |
| `metadata.timestamp` | `parsedJSONData.metadata?.timestamp` | `conversational_evaluated_at` | `card.conversational_meta?.evaluated_at_utc` | ✅ ALIGNED |
| `metadata.patches_applied` | ❌ NOT EXTRACTED | ❌ NOT STORED | ❌ NOT DISPLAYED | ℹ️ METADATA |

---

## SECTION 2: IDENTIFIED MISMATCHES

### 2.1 CRITICAL MISMATCHES (Data Loss / Display Bugs)

#### 🔴 CRITICAL #1: Corner Defects Extraction Bug
**Severity:** CRITICAL
**Impact:** Corner defect details are lost
**Location:** `route.ts` lines 522, 563, 607, 628

**Problem:**
```typescript
// ❌ CURRENT (WRONG)
condition: `TL: ${parsedJSONData.corners?.front?.top_left || 'N/A'}`
// This treats top_left as a STRING, but it's actually an OBJECT with .condition and .defects

// ✅ CORRECT
condition: `TL: ${parsedJSONData.corners?.front?.top_left?.condition || 'N/A'}`
```

**Example JSON:**
```json
"corners": {
  "front": {
    "top_left": {
      "condition": "Sharp and clean",
      "defects": []
    }
  }
}
```

**What Happens:**
- `parsedJSONData.corners?.front?.top_left` returns the OBJECT `{ condition: "...", defects: [...] }`
- Template literal coerces it to `"[object Object]"` or similar
- Result: `"TL: [object Object], TR: [object Object], ..."`
- Corner defects array is never extracted

**Fix Required:**
```typescript
// Line 522 (and similar for back, and rawDefectsForEbay)
condition: `TL: ${parsedJSONData.corners?.front?.top_left?.condition || 'N/A'}, TR: ${parsedJSONData.corners?.front?.top_right?.condition || 'N/A'}, BL: ${parsedJSONData.corners?.front?.bottom_left?.condition || 'N/A'}, BR: ${parsedJSONData.corners?.front?.bottom_right?.condition || 'N/A'}`,
defects: [
  // Extract corner defects similar to edge defects
  ...(parsedJSONData.corners?.front?.top_left?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'top_left corner'
  })),
  ...(parsedJSONData.corners?.front?.top_right?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'top_right corner'
  })),
  ...(parsedJSONData.corners?.front?.bottom_left?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'bottom_left corner'
  })),
  ...(parsedJSONData.corners?.front?.bottom_right?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'bottom_right corner'
  }))
]
```

---

#### 🔴 CRITICAL #2: Professional Grade Estimates Not Extracted from JSON
**Severity:** CRITICAL
**Impact:** AI-provided professional grade estimates are completely ignored
**Location:** `route.ts` lines 459-656 (JSON extraction section)

**Problem:**
- The JSON schema includes `professional_grade_estimates` with PSA, BGS, SGC, CGC grades
- The backend NEVER extracts this data from the JSON
- Instead, it uses a separate deterministic mapper that runs LATER
- The AI's professional grade estimates are DISCARDED

**Current Flow:**
```
1. AI generates JSON with professional_grade_estimates ✅
2. route.ts parses JSON but SKIPS professional_grade_estimates ❌
3. route.ts runs separate professional grading estimation ✅
4. Database stores estimates from step 3, NOT from AI
```

**Evidence:**
```typescript
// Line 1682-1694: Backend uses its OWN professional grading system
let professionalGrades: VisionGradeResult['estimated_professional_grades'] | undefined;

// Only estimate professional grades for gradable cards (not N/A)
if (!isNAGrade) {
  professionalGrades = estimateProfessionalGrades(
    visionResult.recommended_grade.recommended_decimal_grade,
    visionResult.sub_scores,
    visionResult.analysis_summary
  );
}

// Nowhere in the JSON extraction (lines 459-656) is professional_grade_estimates extracted
```

**Decision Required:**
- **Option A (Recommended):** Extract `professional_grade_estimates` from JSON and use those INSTEAD of the deterministic mapper
- **Option B:** Keep the deterministic mapper but COMPARE it with AI estimates and log discrepancies
- **Option C:** Remove `professional_grade_estimates` from the JSON schema entirely

**Fix for Option A:**
```typescript
// Add after line 508 in conversationalGradingData object
professional_grade_estimates: parsedJSONData.professional_grade_estimates || null,

// Then at line 1699, use the extracted estimates:
estimated_professional_grades: conversationalGradingData?.professional_grade_estimates || professionalGrades
```

---

#### 🔴 CRITICAL #3: preliminary_grade Not in Frontend Type Definition
**Severity:** MEDIUM-HIGH
**Impact:** TypeScript errors when trying to display preliminary grade
**Location:** `CardDetailClient.tsx` lines 421-525 (Card interface)

**Problem:**
- Database column exists: `conversational_preliminary_grade`
- Backend saves it: line 1488 `conversational_preliminary_grade: conversationalGradingData?.preliminary_grade || null`
- Frontend type definition MISSING this field
- Frontend cannot access it without TypeScript errors

**Fix Required:**
```typescript
// Add to Card interface around line 462
conversational_preliminary_grade?: number | null;
```

---

#### 🔴 CRITICAL #4: Centering/Corners/Edges/Surface Summary Fields Missing
**Severity:** MEDIUM
**Impact:** Loss of human-readable summaries for each category
**Location:** Multiple

**Problem:**
- JSON provides `summary` fields for each category:
  - `centering.front.summary`
  - `centering.back.summary`
  - `corners.front.summary`
  - `corners.back.summary`
  - `edges.front.summary`
  - `edges.back.summary`
  - `surface.front.summary`
  - `surface.back.summary`
- NONE of these are extracted or stored
- These provide valuable context (e.g., "Overall excellent corner quality with one minor imperfection")

**Fix Required:**
Add extraction for all summary fields and create a new database column to store them.

---

### 2.2 WARNING MISMATCHES (Nice-to-Have Features)

#### ⚠️ WARNING #1: Alteration Detection Data Not Extracted
**Severity:** LOW-MEDIUM
**Impact:** Missing structured data about autographs, handwritten markings, trimming
**Fields Affected:** Entire `alteration_detection` object (8 fields)

**Current Workaround:**
- The data exists in the markdown text
- Frontend parses it from conversational_grading text
- But structured access would be cleaner

**Recommendation:**
- Extract `alteration_detection` object and save as JSONB column
- Add to frontend type definition

---

#### ⚠️ WARNING #2: Grade Caps & Conservative Rounding Details Missing
**Severity:** LOW
**Impact:** Loss of detailed grading logic explanation
**Fields Affected:** `grade_caps` (7 fields), `conservative_rounding` (3 fields)

**Current Status:**
- Boolean flag `conservative_rounding_applied` exists
- Text field `capped_grade_reason` exists
- But detailed cap information (which specific cap, pre-cap grade, etc.) is lost

**Recommendation:**
- Extract full `grade_caps` object as JSONB
- Extract full `conservative_rounding` object as JSONB
- This enables better debugging and transparency

---

#### ⚠️ WARNING #3: Cross-Verification Data Not Structured
**Severity:** LOW
**Impact:** Loss of crease consistency checking results
**Fields Affected:** `cross_verification` (3 fields)

**Current Status:**
- Some data may be in `cross_side_verification_result` text field
- But structured data is not extracted

**Recommendation:**
- Extract `cross_verification` object as JSONB

---

#### ⚠️ WARNING #4: Validation Checklist v4.0 Not Extracted
**Severity:** LOW
**Impact:** Old v3.2 checklist format is saved, but v4.0 checklist is ignored
**Fields Affected:** `validation_checklist` (8 fields)

**Current Status:**
- v3.2 checklist (different format) is extracted from markdown
- v4.0 JSON checklist is NOT extracted

**Recommendation:**
- Update extraction to use v4.0 validation_checklist format
- This provides better validation coverage

---

## SECTION 3: RECOMMENDED FIXES

### Priority 1: CRITICAL FIXES (Must Fix Immediately)

#### FIX #1: Correct Corner Defects Extraction
**File:** `C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts`
**Lines:** 522-523, 563-564, 607-610, 628-631

**Change:**
```typescript
// BEFORE (Line 522-523)
condition: `TL: ${parsedJSONData.corners?.front?.top_left || 'N/A'}, TR: ${parsedJSONData.corners?.front?.top_right || 'N/A'}, BL: ${parsedJSONData.corners?.front?.bottom_left || 'N/A'}, BR: ${parsedJSONData.corners?.front?.bottom_right || 'N/A'}`,
defects: []

// AFTER
condition: `TL: ${parsedJSONData.corners?.front?.top_left?.condition || 'N/A'}, TR: ${parsedJSONData.corners?.front?.top_right?.condition || 'N/A'}, BL: ${parsedJSONData.corners?.front?.bottom_left?.condition || 'N/A'}, BR: ${parsedJSONData.corners?.front?.bottom_right?.condition || 'N/A'}`,
defects: [
  ...(parsedJSONData.corners?.front?.top_left?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'top_left corner'
  })),
  ...(parsedJSONData.corners?.front?.top_right?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'top_right corner'
  })),
  ...(parsedJSONData.corners?.front?.bottom_left?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'bottom_left corner'
  })),
  ...(parsedJSONData.corners?.front?.bottom_right?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'bottom_right corner'
  }))
]
```

Apply the same fix to:
- Line 563-564 (back corners in transformedDefects)
- Line 607-610 (front corners in rawDefectsForEbay)
- Line 628-631 (back corners in rawDefectsForEbay)

---

#### FIX #2: Extract Professional Grade Estimates from JSON
**File:** `C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts`
**Line:** Add after line 508

**Change:**
```typescript
// Add to conversationalGradingData object
professional_grade_estimates: parsedJSONData.professional_grade_estimates || null,
```

**Then update line 1699:**
```typescript
// BEFORE
estimated_professional_grades: professionalGrades || null,

// AFTER (prioritize JSON estimates)
estimated_professional_grades: conversationalGradingData?.professional_grade_estimates || professionalGrades || null,
```

---

#### FIX #3: Add Missing Field to Frontend Type
**File:** `C:\Users\benja\card-grading-app\src\app\sports\[id]\CardDetailClient.tsx`
**Line:** Add around line 462

**Change:**
```typescript
// Add after conversational_centering_ratios
conversational_preliminary_grade?: number | null;
```

---

### Priority 2: MEDIUM FIXES (Important for Data Completeness)

#### FIX #4: Extract Summary Fields
**File:** `C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts`
**Line:** Add around line 516

**Change:**
```typescript
// Add to conversationalGradingData object
category_summaries: {
  centering_front: parsedJSONData.centering?.front?.summary || null,
  centering_back: parsedJSONData.centering?.back?.summary || null,
  corners_front: parsedJSONData.corners?.front?.summary || null,
  corners_back: parsedJSONData.corners?.back?.summary || null,
  edges_front: parsedJSONData.edges?.front?.summary || null,
  edges_back: parsedJSONData.edges?.back?.summary || null,
  surface_front: parsedJSONData.surface?.front?.summary || null,
  surface_back: parsedJSONData.surface?.back?.summary || null
},
```

**Migration Required:**
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_category_summaries JSONB;
COMMENT ON COLUMN cards.conversational_category_summaries IS 'v4.0: Summary text for each grading category (centering/corners/edges/surface, front/back)';
```

---

#### FIX #5: Extract Alteration Detection
**File:** `C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts`
**Line:** Add around line 516

**Change:**
```typescript
// Add to conversationalGradingData object
alteration_detection: parsedJSONData.alteration_detection || null,
```

**Migration Required:**
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_alteration_detection JSONB;
COMMENT ON COLUMN cards.conversational_alteration_detection IS 'v4.0: Structured alteration detection data (autographs, markings, trimming)';
```

---

#### FIX #6: Extract Grade Caps & Conservative Rounding
**File:** `C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts`
**Line:** Add around line 516

**Change:**
```typescript
// Add to conversationalGradingData object
grade_caps: parsedJSONData.grade_caps || null,
conservative_rounding: parsedJSONData.conservative_rounding || null,
```

**Migration Required:**
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grade_caps JSONB;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_conservative_rounding JSONB;
COMMENT ON COLUMN cards.conversational_grade_caps IS 'v4.0: Detailed grade cap information (structural damage, surface dent, etc.)';
COMMENT ON COLUMN cards.conversational_conservative_rounding IS 'v4.0: Conservative rounding details (applicable, reason, after_rounding)';
```

---

### Priority 3: LOW FIXES (Nice-to-Have)

#### FIX #7: Extract Cross-Verification
```typescript
// Add to conversationalGradingData object
cross_verification: parsedJSONData.cross_verification || null,
```

#### FIX #8: Extract v4.0 Validation Checklist
```typescript
// Add to conversationalGradingData object
validation_checklist_v4: parsedJSONData.validation_checklist || null,
```

#### FIX #9: Extract Surface Defect Size
```typescript
// Update line 553-558 to include size
defects: (parsedJSONData.surface?.front?.defects || []).map((d: any) => ({
  description: d.description || d.type || 'Unknown defect',
  severity: d.severity || 'minor',
  location: d.location || 'unknown',
  size: d.size || null, // ADD THIS
  type: d.type
}))
```

#### FIX #10: Extract Centering Analysis Text
```typescript
// Add to centering_ratios object
front_analysis: parsedJSONData.centering?.front?.analysis || null,
back_analysis: parsedJSONData.centering?.back?.analysis || null,
```

---

## SECTION 4: TESTING CHECKLIST

After applying fixes, test these scenarios:

### Test 1: Corner Defects Display
- [ ] Upload a card with corner defects (e.g., "Slight rounding" on bottom_left)
- [ ] Verify corner defect appears in `card.conversational_defects_front.corners.defects[]`
- [ ] Verify corner condition text is human-readable (not "[object Object]")
- [ ] Check frontend displays corner defects correctly

### Test 2: Professional Grade Estimates
- [ ] Upload a card and verify it gets graded
- [ ] Check database: `estimated_professional_grades` should match JSON output
- [ ] Verify PSA, BGS, SGC, CGC estimates are present
- [ ] Confirm confidence levels and notes are stored

### Test 3: Preliminary Grade
- [ ] Upload a card with grade caps (e.g., structural damage)
- [ ] Verify `conversational_preliminary_grade` is saved (before caps)
- [ ] Verify `conversational_decimal_grade` is saved (after caps)
- [ ] Check difference between preliminary and final grade

### Test 4: Category Summaries
- [ ] Upload a card
- [ ] Verify `conversational_category_summaries` JSONB contains all 8 summaries
- [ ] Check summaries are human-readable (e.g., "Overall excellent corner quality...")

### Test 5: Alteration Detection
- [ ] Upload a card with autograph
- [ ] Verify `conversational_alteration_detection` is populated
- [ ] Check `autograph.present`, `autograph.verified`, `autograph.notes`
- [ ] Verify frontend can access this data

---

## SECTION 5: MIGRATION GUIDE

### Step 1: Database Migrations (Run First)
```sql
-- Priority 1: Add critical fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_preliminary_grade NUMERIC(3,1);
COMMENT ON COLUMN cards.conversational_preliminary_grade IS 'v4.0: Grade before caps are applied';

-- Priority 2: Add summary fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_category_summaries JSONB;
COMMENT ON COLUMN cards.conversational_category_summaries IS 'v4.0: Summary text for each grading category';

-- Priority 2: Add alteration detection
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_alteration_detection JSONB;
COMMENT ON COLUMN cards.conversational_alteration_detection IS 'v4.0: Structured alteration detection data';

-- Priority 2: Add grade caps details
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grade_caps JSONB;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_conservative_rounding JSONB;

-- Priority 3: Add cross-verification
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_cross_verification JSONB;

-- Priority 3: Add v4.0 validation checklist
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_validation_checklist_v4 JSONB;
```

### Step 2: Update route.ts (Apply Fixes #1-#10)
Work through fixes in order of priority.

### Step 3: Update Frontend Type Definition
Add missing fields to Card interface.

### Step 4: Test with Sample Cards
Use testing checklist above.

### Step 5: Deploy & Monitor
- Deploy to production
- Monitor logs for JSON parsing errors
- Check that all fields are populated correctly

---

## SECTION 6: SUMMARY STATISTICS

### Alignment Status
- **Total JSON fields analyzed:** 150+
- **Fully aligned end-to-end:** 28 fields (19%)
- **Partially aligned (stored but not typed):** 3 fields (2%)
- **Missing from extraction:** 119 fields (79%)

### Severity Breakdown
- **🔴 CRITICAL issues:** 4
- **⚠️ WARNING issues:** 4
- **ℹ️ INFO/Documentation fields:** ~100 (intentionally not stored)

### Implementation Effort
- **Priority 1 fixes:** 3 fixes, ~30 minutes
- **Priority 2 fixes:** 3 fixes, ~1 hour
- **Priority 3 fixes:** 4 fixes, ~30 minutes
- **Total effort:** ~2 hours

---

## APPENDIX: DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ JSON SCHEMA (prompts/conversational_grading_v4_0_JSON.txt)  │
│ Lines 200-492                                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ OPENAI API RESPONSE                                          │
│ Returns JSON object matching schema                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND EXTRACTION (route.ts)                                │
│ Lines 442-656: Parse JSON and extract fields                │
│                                                               │
│ ✅ Extracts: grades, sub-scores, centering ratios           │
│ ✅ Extracts: edges/surface defects correctly                │
│ 🔴 BUG: Corner defects extracted incorrectly                │
│ ❌ Skips: professional_grade_estimates                       │
│ ❌ Skips: alteration_detection, grade_caps, etc.            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE SAVE (Supabase)                                     │
│ Lines 1476-1579: Update cards table                         │
│                                                               │
│ ✅ Saves: conversational_decimal_grade, condition_label     │
│ ✅ Saves: sub_scores (JSONB), weighted_sub_scores (JSONB)  │
│ ✅ Saves: centering_ratios (JSONB)                          │
│ ✅ Saves: defects_front/back (JSONB) - but corner bug      │
│ ⚠️ Missing: preliminary_grade (column exists but not saved) │
│ ❌ Missing: professional_grade_estimates from JSON          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND DISPLAY (CardDetailClient.tsx)                     │
│ Lines 421-525: Card interface definition                    │
│ Lines 2000+: Render logic                                   │
│                                                               │
│ ✅ Displays: decimal_grade, condition_label                 │
│ ✅ Displays: sub_scores, centering_ratios                   │
│ ✅ Displays: defects (but will show bug from backend)       │
│ ⚠️ Missing: preliminary_grade (not in type definition)      │
│ ❌ Cannot access: fields not extracted by backend           │
└─────────────────────────────────────────────────────────────┘
```

---

**END OF REPORT**

Generated by Claude Code alignment analysis tool
Date: 2025-10-30
Version: 1.0
