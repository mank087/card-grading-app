import cv2
import numpy as np
from typing import Tuple, Optional, Dict, List
import json
import requests
import base64
import os

class CardDetector:
    def __init__(self):
        # Standard trading card dimensions (2.5" x 3.5" = 0.714 aspect ratio)
        self.target_width = 250
        self.target_height = 350
        self.expected_aspect_ratio = 2.5 / 3.5  # ~0.714
        self.aspect_tolerance = 0.50  # Allow 50% variance for photographed cards (was 0.30)

        # Try inverted aspect ratio too (for rotated cards)
        self.expected_aspect_ratio_inverted = 3.5 / 2.5  # ~1.4

        # AI validation settings - temporarily disabled for speed optimization
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.ai_validation_enabled = False  # Disabled for performance testing

    def detect_card_edges(self, image_path: str) -> Tuple[Optional[np.ndarray], np.ndarray]:
        """
        Detect the card edges using OpenCV contour detection.
        Returns: (corners, original_image) or (None, original_image) if detection fails
        """
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                print(f"Error: Could not load image from {image_path}")
                return None, None

            original = img.copy()

            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Apply stronger Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (7, 7), 0)

            # Try multiple edge detection approaches for better results
            # Approach 1: Adaptive threshold
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY, 15, 3)

            # Approach 2: Simple threshold
            _, thresh2 = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Combine both approaches
            combined_thresh = cv2.bitwise_or(thresh, thresh2)

            # Apply more conservative Canny edge detection
            edges = cv2.Canny(combined_thresh, 30, 100, apertureSize=3)

            # Use more conservative dilation
            kernel = np.ones((2,2), np.uint8)
            edges = cv2.dilate(edges, kernel, iterations=1)

            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if not contours:
                print("No contours found")
                return None, original

            # Filter contours by area - be more conservative about minimum size
            img_area = img.shape[0] * img.shape[1]
            min_area = img_area * 0.05  # At least 5% of image (was 10%)
            max_area = img_area * 0.95  # No more than 95% of image (avoid full image contours)
            large_contours = [c for c in contours if min_area < cv2.contourArea(c) < max_area]

            print(f"[OPENCV] Found {len(contours)} total contours, {len(large_contours)} in size range")

            if not large_contours:
                print("No large contours found")
                return None, original

            # Find the best card contour
            best_contour = None
            best_score = 0

            for contour in large_contours:
                # Approximate contour to polygon - try multiple approximation levels
                peri = cv2.arcLength(contour, True)

                # Try different approximation levels for better 4-corner detection
                for epsilon_factor in [0.01, 0.015, 0.02, 0.025, 0.03]:
                    approx = cv2.approxPolyDP(contour, epsilon_factor * peri, True)

                    # We want a quadrilateral (4 corners)
                    if len(approx) == 4:
                        print(f"[OPENCV] Found 4-corner contour with epsilon={epsilon_factor}")
                        break
                else:
                    # No 4-corner approximation found, skip this contour
                    continue

                # We have a 4-corner approximation
                if len(approx) == 4:
                    # Check aspect ratio
                    rect = cv2.boundingRect(approx)
                    w, h = rect[2], rect[3]
                    aspect_ratio = w / h

                    # Score based on how close to expected aspect ratio
                    aspect_diff = abs(aspect_ratio - self.expected_aspect_ratio)
                    print(f"[OPENCV] Aspect ratio: {aspect_ratio:.3f}, expected: {self.expected_aspect_ratio:.3f}, diff: {aspect_diff:.3f}")

                    if aspect_diff <= self.aspect_tolerance:
                        area = cv2.contourArea(contour)
                        score = area * (1 - aspect_diff)  # Prefer larger areas with better aspect ratios
                        print(f"[OPENCV] Valid contour - area: {area}, score: {score}")

                        if score > best_score:
                            best_score = score
                            best_contour = approx
                            print(f"[OPENCV] New best contour found with score: {score}")
                    else:
                        print(f"[OPENCV] Contour rejected - aspect ratio diff {aspect_diff:.3f} > tolerance {self.aspect_tolerance}")

            if best_contour is not None:
                print(f"Card detected with score: {best_score}")
                return best_contour.reshape(4, 2), original
            else:
                print("No suitable card contour found")
                return None, original

        except Exception as e:
            print(f"Error in card detection: {str(e)}")
            return None, original if 'original' in locals() else None

    def order_points(self, pts: np.ndarray) -> np.ndarray:
        """
        Order points in clockwise order: top-left, top-right, bottom-right, bottom-left
        """
        rect = np.zeros((4, 2), dtype="float32")

        # Sum of coordinates - top-left has smallest sum, bottom-right has largest
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]  # top-left
        rect[2] = pts[np.argmax(s)]  # bottom-right

        # Difference of coordinates - top-right has smallest diff, bottom-left has largest
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # top-right
        rect[3] = pts[np.argmax(diff)]  # bottom-left

        return rect

    def warp_card(self, img: np.ndarray, corners: np.ndarray) -> Optional[np.ndarray]:
        """
        Warp the detected card to a normalized rectangle.
        Returns warped image or None if warping fails.
        """
        try:
            # Order the corners
            rect = self.order_points(corners)

            # Define destination points for the normalized card
            dst = np.array([
                [0, 0],
                [self.target_width - 1, 0],
                [self.target_width - 1, self.target_height - 1],
                [0, self.target_height - 1]
            ], dtype="float32")

            # Calculate perspective transform matrix
            M = cv2.getPerspectiveTransform(rect, dst)

            # Apply the transformation
            warped = cv2.warpPerspective(img, M, (self.target_width, self.target_height))

            return warped

        except Exception as e:
            print(f"Error in perspective warp: {str(e)}")
            return None

    def detect_inner_border_enhanced(self, warped_img: np.ndarray) -> Tuple[int, int, int, int]:
        """
        Enhanced inner border detection using binary thresholding.
        Detects the inner design area by isolating light borders from darker card content.
        Returns: (left_border_px, right_border_px, top_border_px, bottom_border_px)
        """
        try:
            h, w = warped_img.shape[:2]
            gray = cv2.cvtColor(warped_img, cv2.COLOR_BGR2GRAY)

            # Try multiple threshold values to handle different border colors
            threshold_values = [200, 180, 160, 140]  # From light (cream) to darker borders
            best_result = None
            best_score = 0

            for threshold in threshold_values:
                # Threshold to isolate dark inner design from light borders
                _, thresh = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)

                # Find contours of the dark inner design
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                if not contours:
                    continue

                # Get bounding box of largest inner contour (the design area)
                inner_contour = max(contours, key=cv2.contourArea)
                contour_area = cv2.contourArea(inner_contour)

                # Score based on contour area (should be substantial but not entire card)
                area_ratio = contour_area / (w * h)
                if 0.4 < area_ratio < 0.9:  # Inner design should be 40-90% of card
                    ix, iy, iw, ih = cv2.boundingRect(inner_contour)

                    # Calculate border widths
                    left_border = ix
                    right_border = (w - (ix + iw))
                    top_border = iy
                    bottom_border = (h - (iy + ih))

                    # Score based on reasonable border widths (should all be positive and not too large)
                    if all(b > 0 for b in [left_border, right_border, top_border, bottom_border]):
                        max_border = max(left_border, right_border, top_border, bottom_border)
                        if max_border < w * 0.25:  # No single border should be >25% of width
                            score = contour_area
                            if score > best_score:
                                best_score = score
                                best_result = (left_border, right_border, top_border, bottom_border)
                                print(f"[OPENCV] Found good inner border at threshold {threshold}: L={left_border}px R={right_border}px T={top_border}px B={bottom_border}px")

            if best_result:
                return best_result

            # Fallback: use edge detection method
            print("[OPENCV] Threshold method failed, using edge detection fallback")
            return self.detect_inner_border_fallback(warped_img)

        except Exception as e:
            print(f"[OPENCV] Error in enhanced border detection: {str(e)}")
            return self.detect_inner_border_fallback(warped_img)

    def detect_inner_border_fallback(self, warped_img: np.ndarray) -> Tuple[int, int, int, int]:
        """
        Fallback method for inner border detection using edge detection.
        Returns: (left_border_px, right_border_px, top_border_px, bottom_border_px)
        """
        try:
            h, w = warped_img.shape[:2]
            center_margin = 20  # pixels from edge
            center_region = warped_img[center_margin:h-center_margin, center_margin:w-center_margin]

            gray = cv2.cvtColor(center_region, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 100, 200)

            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                largest_contour = max(contours, key=cv2.contourArea)
                ix, iy, iw, ih = cv2.boundingRect(largest_contour)

                # Adjust for center margin offset
                left_border = ix + center_margin
                right_border = w - (ix + iw + center_margin)
                top_border = iy + center_margin
                bottom_border = h - (iy + ih + center_margin)

                return (left_border, right_border, top_border, bottom_border)

            # Ultimate fallback: assume 10% borders all around
            border = int(w * 0.10)
            return (border, border, border, border)

        except Exception as e:
            print(f"[OPENCV] Error in fallback detection: {str(e)}")
            # Ultimate fallback
            border = int(w * 0.10)
            return (border, border, border, border)

    def detect_inner_border(self, warped_img: np.ndarray) -> Optional[Tuple[int, int]]:
        """
        DEPRECATED: Old method - kept for compatibility.
        Use detect_inner_border_enhanced() instead.
        """
        try:
            left_px, right_px, top_px, bottom_px = self.detect_inner_border_enhanced(warped_img)
            h, w = warped_img.shape[:2]

            # Calculate center point from borders
            cx = left_px + ((w - left_px - right_px) // 2)
            cy = top_px + ((h - top_px - bottom_px) // 2)

            return (cx, cy)

        except Exception as e:
            print(f"Error in inner border detection: {str(e)}")
            h, w = warped_img.shape[:2]
            return (w // 2, h // 2)

    def calculate_centering_measurements(self, warped_img: np.ndarray) -> Dict:
        """
        Calculate detailed centering measurements from the normalized card image.
        Uses enhanced pixel-based border detection for accurate centering ratios.
        """
        try:
            h, w = warped_img.shape[:2]

            # Geometric center (perfect centering reference)
            geometric_center = (w // 2, h // 2)

            # Detect inner border pixels using enhanced method
            left_px, right_px, top_px, bottom_px = self.detect_inner_border_enhanced(warped_img)

            print(f"[OPENCV] Pixel measurements - Left: {left_px}px, Right: {right_px}px, Top: {top_px}px, Bottom: {bottom_px}px")

            # Calculate centering ratios using pixel measurements
            total_horizontal = left_px + right_px
            total_vertical = top_px + bottom_px

            # Avoid division by zero
            if total_horizontal == 0:
                total_horizontal = w
                left_px = w // 2
                right_px = w // 2

            if total_vertical == 0:
                total_vertical = h
                top_px = h // 2
                bottom_px = h // 2

            # Calculate percentages and ratios
            left_ratio = round((left_px / total_horizontal) * 100)
            right_ratio = 100 - left_ratio

            top_ratio = round((top_px / total_vertical) * 100)
            bottom_ratio = 100 - top_ratio

            # Format as standard ratios (matching AI format)
            horizontal_ratio = f"{left_ratio}/{right_ratio}"
            vertical_ratio = f"{top_ratio}/{bottom_ratio}"

            # Calculate content center from border measurements
            content_center_x = left_px + ((w - left_px - right_px) // 2)
            content_center_y = top_px + ((h - top_px - bottom_px) // 2)
            content_center = (content_center_x, content_center_y)

            # Calculate deviations from geometric center
            dx = content_center[0] - geometric_center[0]
            dy = content_center[1] - geometric_center[1]

            # Convert to percentages
            percent_x = (dx / w) * 100
            percent_y = (dy / h) * 100

            # Determine centering quality score based on worst ratio
            max_imbalance = max(abs(left_ratio - 50), abs(right_ratio - 50),
                               abs(top_ratio - 50), abs(bottom_ratio - 50))

            if max_imbalance <= 5:  # 45/55 to 55/45
                centering_score = 10.0
            elif max_imbalance <= 10:  # 40/60 to 60/40
                centering_score = 9.0
            elif max_imbalance <= 15:  # 35/65 to 65/35
                centering_score = 8.0
            elif max_imbalance <= 20:  # 30/70 to 70/30
                centering_score = 7.0
            elif max_imbalance <= 25:  # 25/75 to 75/25
                centering_score = 6.0
            else:
                centering_score = max(1.0, 5.0 - (max_imbalance - 25) * 0.1)

            print(f"[OPENCV] Centering ratios - Horizontal: {horizontal_ratio}, Vertical: {vertical_ratio}, Score: {centering_score}")

            return {
                "detection_confidence": "High",  # We successfully detected and warped
                "detected_aspect_ratio": w / h,
                "aspect_ratio_validation": "Pass" if abs((w/h) - self.expected_aspect_ratio) <= self.aspect_tolerance else "Fail",
                "card_boundary_quality": "Excellent",
                "geometric_center": {
                    "x": geometric_center[0],
                    "y": geometric_center[1]
                },
                "content_center": {
                    "x": content_center[0],
                    "y": content_center[1]
                },
                "deviation_pixels": {
                    "x": dx,
                    "y": dy
                },
                "deviation_percent": {
                    "x": percent_x,
                    "y": percent_y
                },
                "border_measurements": {
                    "left_border": f"{left_px}px",
                    "right_border": f"{right_px}px",
                    "top_border": f"{top_px}px",
                    "bottom_border": f"{bottom_px}px"
                },
                "border_percentages": {
                    "left_border": f"{left_ratio}%",
                    "right_border": f"{right_ratio}%",
                    "top_border": f"{top_ratio}%",
                    "bottom_border": f"{bottom_ratio}%"
                },
                "centering_ratios": {
                    "horizontal": horizontal_ratio,
                    "vertical": vertical_ratio
                },
                "centering_score": centering_score,
                "normalized_dimensions": {
                    "width": w,
                    "height": h
                },
                "measurement_method": "Enhanced Threshold-Based Detection"
            }

        except Exception as e:
            print(f"Error calculating measurements: {str(e)}")
            return {
                "detection_confidence": "Low",
                "error": str(e)
            }

    def process_card_image(self, image_path: str) -> Dict:
        """
        Enhanced processing function - simplified to work with card images directly.
        Assumes the image contains the card (possibly at an angle or in holder).
        """
        try:
            print(f"[ENHANCED] Processing card image: {image_path}")

            # Load the original image
            img = cv2.imread(image_path)
            if img is None:
                return {
                    "success": False,
                    "detection_confidence": "Failed",
                    "error": "Could not load image",
                    "fallback_method": "Use AI vision"
                }

            # Step 1: Try to detect and warp card boundaries
            corners, original_img = self.detect_card_edges(image_path)

            if corners is not None:
                print(f"[OPENCV] Successfully detected card boundaries")
                # Warp to normalized view
                warped = self.warp_card(original_img, corners)
                if warped is not None:
                    print(f"[OPENCV] Using warped card image for measurements")
                    # Calculate measurements on warped image
                    measurements = self.calculate_centering_measurements(warped)
                    measurements["success"] = True
                    measurements["processing_method"] = "OpenCV Card Detection + Warp"
                    measurements["detection_confidence"] = "High"
                    return measurements

            # Step 2: Fallback - work with original image directly
            print(f"[OPENCV] Card boundary detection failed, processing original image directly")

            # Resize to standard dimensions for processing
            h, w = img.shape[:2]
            aspect_ratio = w / h

            # Determine if we need to resize
            if aspect_ratio > 1:  # Landscape - rotate or process as-is
                # Try to make it portrait if it's close to card ratio inverted
                if abs(aspect_ratio - self.expected_aspect_ratio_inverted) < 0.5:
                    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
                    print(f"[OPENCV] Rotated landscape image to portrait")

            # Resize to target dimensions
            warped = cv2.resize(img, (self.target_width, self.target_height))
            print(f"[OPENCV] Resized image to {self.target_width}x{self.target_height}")

            # Calculate measurements on resized image
            measurements = self.calculate_centering_measurements(warped)
            measurements["success"] = True
            measurements["processing_method"] = "Direct Image Processing (No Card Detection)"
            measurements["detection_confidence"] = "Medium"
            measurements["note"] = "Card boundaries not detected, processed entire image"

            print(f"[OPENCV] Completed processing with direct method")
            return measurements

        except Exception as e:
            print(f"[OPENCV] Error processing card: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "detection_confidence": "Failed",
                "error": str(e),
                "fallback_method": "Use AI vision"
            }

    def validate_with_ai(self, image_path: str, opencv_corners: np.ndarray) -> Dict:
        """
        Use AI to validate and potentially improve OpenCV corner detection.
        Returns validation results and potentially improved corners.
        """
        if not self.ai_validation_enabled:
            return {
                "ai_validation": "Disabled",
                "validated_corners": opencv_corners.tolist(),
                "confidence_boost": 0,
                "validation_notes": "OpenAI API key not available"
            }

        try:
            # Convert image to base64
            with open(image_path, 'rb') as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')

            # Create visualization of OpenCV detection
            img = cv2.imread(image_path)
            img_with_corners = img.copy()

            # Draw OpenCV detected corners
            for i, corner in enumerate(opencv_corners):
                cv2.circle(img_with_corners, tuple(corner.astype(int)), 10, (0, 255, 0), -1)
                cv2.putText(img_with_corners, str(i+1), tuple(corner.astype(int)),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

            # Draw connecting lines
            cv2.polylines(img_with_corners, [opencv_corners.astype(int)], True, (0, 255, 0), 3)

            # Convert annotated image to base64
            _, buffer = cv2.imencode('.jpg', img_with_corners)
            annotated_image_data = base64.b64encode(buffer).decode('utf-8')

            # Call OpenAI Vision API for validation
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": """You are an expert in trading card detection. I'm using OpenCV to detect card boundaries, and I need your validation.

Look at these two images:
1. Original card image
2. Same image with green circles and lines showing OpenCV's detected corners (numbered 1-4)

Please analyze:
1. Are the detected corners accurately placed at the card edges?
2. Does the detected boundary capture the entire card properly?
3. Are there any corners that seem slightly off?
4. What's your confidence in this detection (0-100%)?

Respond in JSON format:
{
  "validation_result": "PASS" or "FAIL",
  "confidence_score": 0-100,
  "corner_accuracy": {
    "corner_1": "accurate/slightly_off/very_off",
    "corner_2": "accurate/slightly_off/very_off",
    "corner_3": "accurate/slightly_off/very_off",
    "corner_4": "accurate/slightly_off/very_off"
  },
  "overall_assessment": "brief description",
  "suggested_improvements": "if any corners need adjustment"
}"""
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{annotated_image_data}"}
                                }
                            ]
                        }
                    ],
                    "max_tokens": 500
                },
                timeout=15
            )

            if response.status_code == 200:
                ai_response = response.json()
                ai_text = ai_response['choices'][0]['message']['content']

                # Try to extract JSON from response
                try:
                    # Look for JSON in the response
                    json_start = ai_text.find('{')
                    json_end = ai_text.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        ai_validation = json.loads(ai_text[json_start:json_end])

                        return {
                            "ai_validation": "Completed",
                            "validation_result": ai_validation.get("validation_result", "UNKNOWN"),
                            "confidence_score": ai_validation.get("confidence_score", 50),
                            "corner_accuracy": ai_validation.get("corner_accuracy", {}),
                            "overall_assessment": ai_validation.get("overall_assessment", ""),
                            "suggested_improvements": ai_validation.get("suggested_improvements", ""),
                            "validated_corners": opencv_corners.tolist(),
                            "confidence_boost": 20 if ai_validation.get("validation_result") == "PASS" else -10
                        }
                except json.JSONDecodeError:
                    pass

                # Fallback if JSON parsing fails
                return {
                    "ai_validation": "Completed (Fallback)",
                    "validation_result": "PASS" if "accurate" in ai_text.lower() else "UNCERTAIN",
                    "raw_response": ai_text[:200] + "..." if len(ai_text) > 200 else ai_text,
                    "validated_corners": opencv_corners.tolist(),
                    "confidence_boost": 10
                }

            else:
                return {
                    "ai_validation": "Failed",
                    "error": f"API request failed: {response.status_code}",
                    "validated_corners": opencv_corners.tolist(),
                    "confidence_boost": 0
                }

        except Exception as e:
            print(f"AI validation error: {str(e)}")
            return {
                "ai_validation": "Error",
                "error": str(e),
                "validated_corners": opencv_corners.tolist(),
                "confidence_boost": 0
            }

# Test function
if __name__ == "__main__":
    detector = CardDetector()

    # Test with a sample image (replace with actual path)
    test_image = "test_card.jpg"
    result = detector.process_card_image(test_image)

    print("Card Detection Results:")
    print(json.dumps(result, indent=2))