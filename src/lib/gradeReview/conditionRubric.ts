// Frozen from DCM v9.23 rubric sections 8, 9 and 10. Update with the supported review version.
export const CONDITION_RUBRIC = {
  "corners_10": {
    "category": "corners",
    "score": 10,
    "descriptor": "ALL corners sharp: zero fiber exposure or softening even on close inspection; perfect apexes"
  },
  "corners_9": {
    "category": "corners",
    "score": 9,
    "descriptor": "ONE corner with a pinpoint of whitening/trace fiber/slight softening, detectable ONLY on close inspection , a single minor flaw (single-flaw tolerance)"
  },
  "corners_8": {
    "category": "corners",
    "score": 8,
    "descriptor": "Minor close-inspection-only wear on TWO OR MORE corners (slightest close-inspection wear on one or two corners) , still not noticeable at normal viewing distance"
  },
  "corners_7": {
    "category": "corners",
    "score": 7,
    "descriptor": "Whitening or softening plainly NOTICEABLE at normal viewing distance on 1-2 corners; points still defined"
  },
  "corners_6": {
    "category": "corners",
    "score": 6,
    "descriptor": "Noticeable wear on MULTIPLE corners, or obvious blunting on one corner"
  },
  "corners_5": {
    "category": "corners",
    "score": 5,
    "descriptor": "Widespread moderate wear with early rounding (points starting to round over)"
  },
  "corners_4": {
    "category": "corners",
    "score": 4,
    "descriptor": "Clear rounding , one or more corners no longer pointed"
  },
  "corners_3": {
    "category": "corners",
    "score": 3,
    "descriptor": "Heavy rounding , obvious rounded profiles across corners"
  },
  "corners_2": {
    "category": "corners",
    "score": 2,
    "descriptor": "Severe/extreme damage , corners nearly circular or material loss"
  },
  "corners_1": {
    "category": "corners",
    "score": 1,
    "descriptor": "Corner(s) missing/destroyed"
  },
  "edges_10": {
    "category": "edges",
    "score": 10,
    "descriptor": "ALL edges clean: zero whitening even on close inspection; smooth factory cut"
  },
  "edges_9": {
    "category": "edges",
    "score": 9,
    "descriptor": "ONE tiny white fleck/speck detectable ONLY on close inspection , a single minor flaw (single-flaw tolerance)"
  },
  "edges_8": {
    "category": "edges",
    "score": 8,
    "descriptor": "2-3 tiny close-inspection-only flecks (possibly on more than one edge), or isolated minor roughness , still not noticeable at normal viewing distance"
  },
  "edges_7": {
    "category": "edges",
    "score": 7,
    "descriptor": "Whitening plainly NOTICEABLE at normal viewing distance along part of ONE edge, or a single tiny chip"
  },
  "edges_6": {
    "category": "edges",
    "score": 6,
    "descriptor": "Noticeable whitening on MULTIPLE edges, or continuous whitening along much of one edge, or a clearly noticeable chip (vintage dark backs: visible border whitening on 2+ edges lands HERE)"
  },
  "edges_5": {
    "category": "edges",
    "score": 5,
    "descriptor": "Heavy whitening across substantial portions of the edges, or multiple chips"
  },
  "edges_4": {
    "category": "edges",
    "score": 4,
    "descriptor": "Whitening along most edge length, or heavy chipping throughout"
  },
  "edges_3": {
    "category": "edges",
    "score": 3,
    "descriptor": "Nearly continuous whitening, or severe chipping/material loss"
  },
  "edges_2": {
    "category": "edges",
    "score": 2,
    "descriptor": "Complete edge wear or major material loss"
  },
  "edges_1": {
    "category": "edges",
    "score": 1,
    "descriptor": "Edge destroyed/delaminated"
  },
  "surface_10": {
    "category": "surface",
    "score": 10,
    "descriptor": "No confirmed handling defects. (A single minor manufacturing print dot, <0.3mm in a non-critical area, is ACCEPTABLE , note it in the analysis text, do NOT list it in the defects array.)"
  },
  "surface_9": {
    "category": "surface",
    "score": 9,
    "descriptor": "ONE minor close-inspection-only flaw: a hairline scratch visible only at an angle, OR 1-2 tiny white dots, OR a trace mark , a single minor flaw (single-flaw tolerance)"
  },
  "surface_8": {
    "category": "surface",
    "score": 8,
    "descriptor": "TWO OR MORE minor close-inspection-only flaws, or a light scratch (<1cm) found on close inspection, or a small print defect, or 3-4 white dots, or minor gloss loss/holo disruption , still clean at normal viewing distance"
  },
  "surface_7": {
    "category": "surface",
    "score": 7,
    "descriptor": "A scratch, mark, or print defect plainly NOTICEABLE at normal viewing distance; or 5+ white dots; or moderate gloss loss or indentation"
  },
  "surface_6": {
    "category": "surface",
    "score": 6,
    "descriptor": "Multiple noticeable defects; large print defect; heavy gloss loss; small stain (<2mm); noticeable holo pattern disruption"
  },
  "surface_5": {
    "category": "surface",
    "score": 5,
    "descriptor": "Clear/obvious scratching; noticeable defects on BOTH faces; medium stain (2-5mm); severe gloss loss; loss of original sheen across areas"
  },
  "surface_4": {
    "category": "surface",
    "score": 4,
    "descriptor": "Deep scratch into coating; heavy scratching; large stain (>5mm); multiple stains"
  },
  "surface_3": {
    "category": "surface",
    "score": 3,
    "descriptor": "Deep scratch through coating; heavy staining"
  },
  "surface_2": {
    "category": "surface",
    "score": 2,
    "descriptor": "Gouges/severe scratching; severe contamination; major damage"
  },
  "surface_1": {
    "category": "surface",
    "score": 1,
    "descriptor": "Surface destroyed"
  }
} as const;
