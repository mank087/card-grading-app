from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import requests
from card_detector import CardDetector

# v3.4: Import adaptive hybrid processor
try:
    from stage0_card_detector_v3_4 import process_card_url as process_card_v3_4
    V3_4_AVAILABLE = True
    print("[INIT] v3.4 processor loaded successfully")
except ImportError as e:
    V3_4_AVAILABLE = False
    print(f"[INIT] v3.4 processor not available: {e}")

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js integration

# Initialize the card detector (legacy/fallback)
detector = CardDetector()

# Feature flag: Use v3.4 processor by default if available
USE_V3_4 = os.getenv('USE_OPENCV_V3_4', 'true').lower() == 'true' and V3_4_AVAILABLE

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "card-detection-service",
        "version": "3.4.1",
        "processor": "v3.4.1 adaptive hybrid" if USE_V3_4 else "legacy",
        "features": {
            "borderless_support": USE_V3_4,
            "design_anchor_centering": USE_V3_4,
            "image_quality_grading": USE_V3_4,
            "clahe_enhancement": USE_V3_4,
            "numeric_centering_ratios": USE_V3_4,
            "reshoot_detection": USE_V3_4,
            "area_sanity_check": USE_V3_4,
            "adaptive_thresholding": USE_V3_4,
            "accurate_border_measurement": USE_V3_4,
            "quadrilateral_detection": USE_V3_4,
            "debug_overlay_export": USE_V3_4
        }
    })

@app.route('/detect-card', methods=['POST'])
def detect_card():
    """
    Main endpoint for card detection and measurement.
    v3.4: Uses adaptive hybrid processor with:
    - Adaptive thresholding for white-border cards
    - Stricter quadrilateral contour filtering
    - Accurate border width measurement
    - Debug overlay export (when STAGE0_DEBUG=true)
    Accepts front_url and back_url for sports cards.
    """
    try:
        data = request.json

        # Check if front and back URLs provided
        if not data or ('front_url' not in data and 'back_url' not in data and 'image_url' not in data):
            return jsonify({"error": "No image URLs provided. Send 'front_url' and 'back_url' or 'image_url'"}), 400

        results = {}
        processor_version = "v3.4" if USE_V3_4 else "legacy"
        print(f"[DETECT-CARD] Using processor: {processor_version}", flush=True)

        # Process front image
        if 'front_url' in data:
            front_url = data['front_url']
            print(f"[OPENCV] Processing front card: {front_url[:100]}...", flush=True)

            try:
                if USE_V3_4:
                    # v3.4: Direct URL processing with adaptive thresholding
                    front_result, cropped_path = process_card_v3_4(front_url, "front")
                    results['front_centering'] = front_result

                    # Cleanup cropped image if created
                    if cropped_path and os.path.exists(cropped_path):
                        try:
                            os.unlink(cropped_path)
                        except:
                            pass
                else:
                    # Legacy: Download and process
                    response = requests.get(front_url, timeout=30)
                    response.raise_for_status()

                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                    temp_file.write(response.content)
                    temp_file.flush()
                    temp_file.close()

                    front_result = detector.process_card_image(temp_file.name)
                    results['front_centering'] = front_result

                    # Cleanup
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass

            except Exception as e:
                print(f"[OPENCV] Error processing front: {str(e)}")
                results['front_centering'] = {"success": False, "error": str(e)}

        # Process back image
        if 'back_url' in data:
            back_url = data['back_url']
            print(f"[OPENCV] Processing back card: {back_url[:100]}...")

            try:
                if USE_V3_4:
                    # v3.4: Direct URL processing with adaptive thresholding
                    back_result, cropped_path = process_card_v3_4(back_url, "back")
                    results['back_centering'] = back_result

                    # Cleanup cropped image if created
                    if cropped_path and os.path.exists(cropped_path):
                        try:
                            os.unlink(cropped_path)
                        except:
                            pass
                else:
                    # Legacy: Download and process
                    response = requests.get(back_url, timeout=30)
                    response.raise_for_status()

                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                    temp_file.write(response.content)
                    temp_file.flush()
                    temp_file.close()

                    back_result = detector.process_card_image(temp_file.name)
                    results['back_centering'] = back_result

                    # Cleanup
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass

            except Exception as e:
                print(f"[OPENCV] Error processing back: {str(e)}")
                results['back_centering'] = {"success": False, "error": str(e)}

        # Handle single image URL (legacy support)
        if 'image_url' in data and not results:
            image_url = data['image_url']
            print(f"[OPENCV] Processing single card: {image_url[:100]}...")

            try:
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()

                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                temp_file.write(response.content)
                temp_file.flush()
                temp_file.close()

                result = detector.process_card_image(temp_file.name)

                # Cleanup
                try:
                    os.unlink(temp_file.name)
                except:
                    pass

                return jsonify({
                    "success": result.get("success", False),
                    "card_detection": result
                })

            except Exception as e:
                print(f"[OPENCV] Error processing single image: {str(e)}")
                return jsonify({"success": False, "error": str(e)}), 200

        # Check if both front and back succeeded
        front_success = results.get('front_centering', {}).get('success', False)
        back_success = results.get('back_centering', {}).get('success', False)

        overall_success = front_success and back_success

        return jsonify({
            "success": overall_success,
            "front_centering": results.get('front_centering', {}),
            "back_centering": results.get('back_centering', {})
        }), 200

    except Exception as e:
        print(f"[OPENCV] Error in detect_card endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "fallback_method": "Use AI vision"
        }), 500

@app.route('/detect-card-batch', methods=['POST'])
def detect_card_batch():
    """
    Batch processing endpoint for multiple cards.
    Useful for processing front and back images together.
    """
    try:
        data = request.json
        if not data or 'images' not in data:
            return jsonify({"error": "No images array provided"}), 400

        results = {}

        for image_key, image_url in data['images'].items():
            try:
                # Download and process each image
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()

                # Save temporarily
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                temp_file.write(response.content)
                temp_file.flush()
                temp_file.close()  # Explicitly close before processing

                # Process
                result = detector.process_card_image(temp_file.name)
                results[image_key] = result

                # Cleanup with retry for Windows
                try:
                    os.unlink(temp_file.name)
                except PermissionError:
                    # On Windows, sometimes need a brief delay
                    import time
                    time.sleep(0.1)
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass  # If still can't delete, leave for OS cleanup

            except Exception as e:
                results[image_key] = {
                    "success": False,
                    "error": str(e),
                    "fallback_method": "Use estimation"
                }

        return jsonify({
            "success": True,
            "results": results
        })

    except Exception as e:
        print(f"Error in batch processing: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    print("Starting Card Detection Service...")
    print("Available endpoints:")
    print("  GET  /health          - Health check")
    print("  POST /detect-card     - Single card detection")
    print("  POST /detect-card-batch - Batch card detection")
    print("")

    # Development server
    app.run(host='0.0.0.0', port=5001, debug=True)