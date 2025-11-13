#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask API wrapper for OpenCV Card Analysis Service
Provides HTTP endpoint for Next.js to call OpenCV analysis
"""

import os
import json
import tempfile
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import the core OpenCV analysis function
from card_cv_stage1 import analyze_side, serialize_combined_metrics, CombinedMetrics

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js calls

# Configuration
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'opencv-card-analysis',
        'version': 'v1.0'
    }), 200


@app.route('/analyze', methods=['POST'])
def analyze_card():
    """
    Analyze card images using OpenCV

    Expects multipart/form-data with:
    - front: image file (required)
    - back: image file (optional)

    Returns JSON metrics including:
    - Centering measurements
    - Edge whitening detection
    - Corner analysis
    - Surface defect detection
    - Sleeve/glare indicators
    """
    try:
        # Check if files are present
        if 'front' not in request.files and 'back' not in request.files:
            return jsonify({
                'error': 'No file provided',
                'message': 'Please provide at least one image (front or back)'
            }), 400

        front_file = request.files.get('front')
        back_file = request.files.get('back')

        # Validate files
        if front_file and not allowed_file(front_file.filename):
            return jsonify({
                'error': 'Invalid file type',
                'message': f'Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        if back_file and not allowed_file(back_file.filename):
            return jsonify({
                'error': 'Invalid file type',
                'message': f'Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        # Create temporary directory for this analysis
        run_id = str(uuid.uuid4())
        temp_dir = os.path.join(tempfile.gettempdir(), f'opencv_analysis_{run_id}')
        os.makedirs(temp_dir, exist_ok=True)

        # Save uploaded files
        front_path = None
        back_path = None

        if front_file and front_file.filename:
            front_filename = secure_filename(front_file.filename)
            front_path = os.path.join(temp_dir, f'front_{front_filename}')
            front_file.save(front_path)

        if back_file and back_file.filename:
            back_filename = secure_filename(back_file.filename)
            back_path = os.path.join(temp_dir, f'back_{back_filename}')
            back_file.save(back_path)

        # Create output directory
        output_dir = os.path.join(temp_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        # Analyze front and back
        front_metrics = None
        back_metrics = None

        if front_path:
            front_metrics = analyze_side(front_path, output_dir, 'front')

        if back_path:
            back_metrics = analyze_side(back_path, output_dir, 'back')

        # Combine metrics
        combined = CombinedMetrics(
            front=front_metrics,
            back=back_metrics,
            run_id=run_id
        )

        # Serialize to JSON
        result = serialize_combined_metrics(combined)

        # Clean up temp files (keep output for debugging)
        if front_path and os.path.exists(front_path):
            os.remove(front_path)
        if back_path and os.path.exists(back_path):
            os.remove(back_path)

        return jsonify(result), 200

    except Exception as e:
        app.logger.error(f'Error analyzing card: {str(e)}')
        return jsonify({
            'error': 'Analysis failed',
            'message': str(e)
        }), 500


@app.route('/analyze-url', methods=['POST'])
def analyze_card_from_url():
    """
    Analyze card images from URLs (for Supabase integration)

    Expects JSON with:
    - frontUrl: string (required)
    - backUrl: string (optional)

    Returns same metrics as /analyze endpoint
    """
    try:
        import requests

        data = request.get_json()

        if not data or 'frontUrl' not in data:
            return jsonify({
                'error': 'No URL provided',
                'message': 'Please provide frontUrl in request body'
            }), 400

        front_url = data.get('frontUrl')
        back_url = data.get('backUrl')

        # Create temporary directory for this analysis
        run_id = str(uuid.uuid4())
        temp_dir = os.path.join(tempfile.gettempdir(), f'opencv_analysis_{run_id}')
        os.makedirs(temp_dir, exist_ok=True)

        # Download images
        front_path = None
        back_path = None

        if front_url:
            front_response = requests.get(front_url, timeout=30)
            front_response.raise_for_status()
            front_path = os.path.join(temp_dir, 'front.jpg')
            with open(front_path, 'wb') as f:
                f.write(front_response.content)

        if back_url:
            back_response = requests.get(back_url, timeout=30)
            back_response.raise_for_status()
            back_path = os.path.join(temp_dir, 'back.jpg')
            with open(back_path, 'wb') as f:
                f.write(back_response.content)

        # Create output directory
        output_dir = os.path.join(temp_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        # Analyze front and back
        front_metrics = None
        back_metrics = None

        if front_path:
            front_metrics = analyze_side(front_path, output_dir, 'front')

        if back_path:
            back_metrics = analyze_side(back_path, output_dir, 'back')

        # Combine metrics
        combined = CombinedMetrics(
            front=front_metrics,
            back=back_metrics,
            run_id=run_id
        )

        # Serialize to JSON
        result = serialize_combined_metrics(combined)

        # Clean up temp files
        if front_path and os.path.exists(front_path):
            os.remove(front_path)
        if back_path and os.path.exists(back_path):
            os.remove(back_path)

        return jsonify(result), 200

    except requests.exceptions.RequestException as e:
        app.logger.error(f'Error downloading image: {str(e)}')
        return jsonify({
            'error': 'Failed to download image',
            'message': str(e)
        }), 500

    except Exception as e:
        app.logger.error(f'Error analyzing card: {str(e)}')
        return jsonify({
            'error': 'Analysis failed',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    print('🚀 OpenCV Card Analysis Service')
    print('================================')
    print('Endpoints:')
    print('  GET  /health                - Health check')
    print('  POST /analyze               - Analyze uploaded images')
    print('  POST /analyze-url           - Analyze images from URLs')
    print('')
    print('Starting server on http://localhost:5000')
    print('Press Ctrl+C to stop')

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
