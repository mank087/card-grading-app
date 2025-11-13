# OpenCV Centering Methodology
## Comprehensive Card Centering Detection and Measurement

This document defines the OpenCV centering measurement methodology aligned with Phase 1 AI grading instructions. The goal is to accurately measure card centering across all card types using computer vision.

---

## 🎯 **Core Principles**

1. **Card Boundary Detection First**: Always detect the physical card edges before measuring centering
2. **Background Exclusion**: Never include background/table/holder in measurements
3. **Multi-Method Support**: Detect card type and apply appropriate centering method
4. **Fallback Mechanisms**: If one method fails, try alternatives
5. **Conservative Defaults**: When uncertain, flag as "unreliable" rather than guess

---

## 📐 **Centering Measurement Methods**

### **Method A: Border-Present Cards**

**When to Use:**
- Card has visible borders (white, colored, or patterned) around the artwork
- Clear contrast between border and printed design
- Examples: Most vintage cards, Topps chrome, base set cards

**Detection Strategy:**
```python
# 1. Detect card quadrilateral (physical edges)
# 2. Convert to LAB color space for better edge detection
# 3. For each side (L/R/T/B):
#    - Scan inward from physical edge
#    - Find largest gradient (border → design transition)
#    - Measure distance from edge to gradient peak
# 4. Calculate ratios
```

**Detection Thresholds:**
- Gradient magnitude > 10 (in LAB L channel)
- Border width should be 2-10mm (reasonable range)
- Reject if border > 15mm or < 1mm (likely error)

**Reliability Check:**
- ✅ **Reliable** if clear gradient found on all 4 sides
- ⚠️ **Medium** if 3 sides have clear gradients
- ❌ **Unreliable** if < 3 sides have clear gradients

---

### **Method C: Design-Anchor / Full-Bleed Cards**

**When to Use:**
- No visible borders (artwork extends to edges)
- Modern cards (Pokémon EX, Panini Prizm, alt arts)
- Borderless parallels, acetate cards

**Detection Strategy:**
```python
# Method C is NOT pixel-based - it requires AI/semantic analysis
# OpenCV cannot identify "logos" or "text boxes" semantically
#
# FALLBACK APPROACH:
# 1. Detect this is a borderless card (no clear gradients found)
# 2. Flag centering as "method: design-anchor-required"
# 3. Set use_opencv_centering = False
# 4. Let LLM handle centering using visual anchors
```

**OpenCV Limitations:**
- Cannot detect semantic features (logos, player position, text boxes)
- Cannot determine intentional vs unintentional off-center designs
- **Solution**: Flag card for LLM centering assessment

**Reliability Check:**
- ❌ **Always Unreliable** for OpenCV (requires LLM)

---

### **Method E: Transparent/Acetate Cards**

**When to Use:**
- Card has transparent/clear plastic margins
- Printed ink area is smaller than physical card
- Common in acetate inserts, see-through parallels

**Detection Strategy:**
```python
# 1. Detect alpha channel or transparency indicators
# 2. Find printed ink boundaries (not physical edges)
# 3. Measure from ink boundary to physical edge on each side
# 4. Calculate ratios based on clear margin widths
```

**Reliability Check:**
- ✅ **Reliable** if transparency clearly detected
- ❌ **Unreliable** if ambiguous

---

## 🔧 **Card Boundary Detection (Critical Step)**

### **Problem: Background Contamination**

**Current Issue:**
The `detect_card_quadrilateral()` function sometimes detects:
- Background edges instead of card edges
- Table surface boundaries
- Shadow perimeters
- Protective case outer edges

**Solution: Multi-Stage Detection**

```python
def detect_card_quadrilateral_robust(img_bgr: np.ndarray) -> Optional[np.ndarray]:
    """
    Robust card detection with background exclusion.

    Strategy:
    1. Try standard Canny + contour detection
    2. Validate aspect ratio (cards are ~0.63-0.72 ratio)
    3. Validate size (card should be 60-95% of image area)
    4. If validation fails, try alternative methods
    """

    # STEP 1: Standard detection
    quad = detect_card_quadrilateral_standard(img_bgr)

    # STEP 2: Validate detected quadrilateral
    if quad is not None:
        is_valid, reason = validate_card_quad(img_bgr, quad)
        if is_valid:
            return quad
        print(f"[OpenCV] Card quad rejected: {reason}")

    # STEP 3: Fallback - try with different thresholds
    quad = detect_card_quadrilateral_adaptive(img_bgr)
    if quad is not None:
        is_valid, _ = validate_card_quad(img_bgr, quad)
        if is_valid:
            return quad

    # STEP 4: Final fallback - assume card fills most of frame
    return detect_card_quadrilateral_fullframe(img_bgr)

def validate_card_quad(img_bgr: np.ndarray, quad: np.ndarray) -> Tuple[bool, str]:
    """
    Validate that detected quadrilateral is actually a card.

    Checks:
    1. Aspect ratio (~0.63-0.72 for standard cards)
    2. Size (should be 50-98% of image area)
    3. Not too skewed (perspective < 30 degrees)
    """
    h, w = img_bgr.shape[:2]
    image_area = h * w

    # Calculate quad area
    quad_area = cv2.contourArea(quad)
    area_ratio = quad_area / image_area

    # Calculate aspect ratio
    (tl, tr, br, bl) = quad
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    aspect = width / height if height > 0 else 0

    # Validation checks
    if area_ratio < 0.5:
        return False, f"Card too small ({area_ratio:.1%} of image)"
    if area_ratio > 0.98:
        return False, f"Card fills entire frame ({area_ratio:.1%}) - likely detecting background"
    if aspect < 0.55 or aspect > 0.80:
        return False, f"Invalid aspect ratio ({aspect:.2f}) - cards are ~0.63-0.72"

    return True, "Valid card detected"
```

---

## 🚦 **Decision Tree: Which Method to Use**

```
START: Analyze card image
    ↓
    ├─→ [Card boundary detection successful?]
    │   ├─→ NO → Flag as unreliable, use LLM
    │   └─→ YES → Continue
    │
    ├─→ [Border detection: Scan for gradients]
    │   ├─→ Clear gradients on all 4 sides?
    │   │   ├─→ YES → Use METHOD A (Border-Present)
    │   │   └─→ NO → Continue
    │   │
    │   ├─→ Clear gradients on 3 sides?
    │   │   ├─→ YES → Use METHOD A (Border-Present, medium confidence)
    │   │   └─→ NO → Continue
    │   │
    │   └─→ < 3 sides with clear gradients?
    │       └─→ Flag as "design-anchor-required"
    │       └─→ Set use_opencv_centering = False
    │       └─→ Let LLM handle centering
    │
    └─→ [Transparency detection]
        ├─→ Transparency detected?
        │   └─→ Use METHOD E (Acetate)
        └─→ Otherwise → Use LLM
```

---

## ⚙️ **Implementation Checklist**

### **Phase 1: Card Boundary Detection** (CRITICAL)
- [ ] Implement `validate_card_quad()` with aspect ratio checks
- [ ] Implement `detect_card_quadrilateral_adaptive()` with multiple thresholds
- [ ] Add area ratio validation (50-98% of frame)
- [ ] Reject detections that include obvious background

### **Phase 2: Centering Method Detection**
- [ ] Implement gradient-based border detection for Method A
- [ ] Add border width validation (2-15mm range)
- [ ] Count how many sides have clear borders
- [ ] Flag borderless cards for LLM assessment

### **Phase 3: Measurement Execution**
- [ ] For Method A: Measure border widths accurately
- [ ] For borderless: Return `method: "design-anchor-required"`
- [ ] Calculate L/R and T/B ratios
- [ ] Add confidence scoring

### **Phase 4: Reliability Reporting**
- [ ] Report which method was used
- [ ] Report confidence level (high/medium/low)
- [ ] Report validation failures (if any)
- [ ] Provide fallback recommendations

---

## 📊 **Expected Output Format**

```json
{
  "centering": {
    "lr_ratio": [48.5, 51.5],
    "tb_ratio": [50.2, 49.8],
    "left_border_mean_px": 12.3,
    "right_border_mean_px": 13.1,
    "top_border_mean_px": 12.8,
    "bottom_border_mean_px": 12.7,
    "method_used": "border-present",  // NEW
    "confidence": "high",              // NEW
    "validation_notes": "Clear borders detected on all 4 sides, aspect ratio 0.68"  // NEW
  }
}
```

---

## 🔍 **Troubleshooting Common Issues**

### **Issue: Extreme centering ratios (e.g., 8/92, 95/5)**

**Causes:**
1. Card boundary detection failed (detected background instead)
2. Gradient detection found wrong edge (case/sleeve edge)
3. Very dark or low-contrast card borders

**Solution:**
1. Check aspect ratio of detected quad
2. Check area ratio (should be 50-95% of image)
3. If validation fails → Flag as unreliable
4. Don't apply grade cap unless protective case IS detected

### **Issue: Width/height mismatch (e.g., back is 6457px wide)**

**Causes:**
1. `warp_to_rect()` received invalid quadrilateral
2. Perspective transform failed
3. OpenCV detected horizontal object instead of vertical card

**Solution:**
1. Validate quad before warping
2. Check if width > height when it should be height > width
3. Reject and use fallback if aspect ratio is wrong

### **Issue: No gradients found (borderless card)**

**Causes:**
1. Card is full-bleed design (normal)
2. Very low contrast between border and design
3. Card is in protective case obscuring borders

**Solution:**
1. Flag as `method: "design-anchor-required"`
2. Set `use_opencv_centering = False`
3. Let LLM perform visual centering assessment
4. **DO NOT** guess or apply grade cap

---

## ✅ **Success Criteria**

**High Confidence Centering:**
- Card boundary validated (aspect ratio 0.63-0.72)
- Clear gradients found on all 4 sides
- Border widths in reasonable range (2-15mm)
- Measurements consistent across sampling points

**Medium Confidence Centering:**
- Card boundary validated
- Clear gradients on 3 sides
- One side ambiguous but estimable

**Low Confidence / Unreliable:**
- Card boundary detection failed
- < 3 sides with clear gradients
- Borderless/full-bleed card detected
- Protective case indicators present

**Action for Unreliable:**
- Set `use_opencv_centering = False`
- Let LLM perform centering assessment
- Include note in OpenCV summary: "Centering measurement unreliable - using LLM visual inspection"

---

## 📝 **Next Steps**

1. Review this methodology
2. Implement Phase 1 (Card Boundary Detection with validation)
3. Test on problem card to verify boundary detection
4. Implement Phase 2 (Centering Method Detection)
5. Test on variety of card types (border-present, borderless, acetate)
6. Integrate with reliability checker to properly handle failures
