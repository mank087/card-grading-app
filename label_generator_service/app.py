#!/usr/bin/env python3
"""
Dynamic Card Label Generator Service
Generates Avery 6871 labels for graded trading cards
"""

import io
import qrcode
import tempfile
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import Color, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing, Rect
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class AveryLabelGenerator:
    """Generator for Avery 6871 labels (1.25" x 2.375")"""

    def __init__(self):
        # Avery template specifications (18 labels per sheet, 3 columns x 6 rows)
        self.label_width = 2.375 * inch  # 2-3/8"
        self.label_height = 1.25 * inch  # 1-1/4"
        self.cols = 3
        self.rows = 6
        self.margin_top = 0.5 * inch
        self.margin_left = 0.5 * inch
        self.col_spacing = 0.125 * inch
        self.row_spacing = 0 * inch

        # DCM Brand Colors - exact specification
        self.dcm_purple = Color(75/255, 46/255, 131/255)  # #4B2E83
        self.dcm_gray = Color(0.3, 0.3, 0.3)    # Text gray

    def generate_qr_code(self, url: str, size_inches: float = 0.4):
        """Generate QR code for the card URL"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=3,
            border=1,
        )
        qr.add_data(url)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="black", back_color="white")

        # Create temporary file for QR code
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        qr_img.save(temp_file.name)
        temp_file.close()

        return temp_file.name

    def get_dynamic_font_size(self, c, text, max_width, base_font, base_size, min_size=5):
        """Calculate font size to fit text within max_width"""
        current_size = base_size
        while current_size >= min_size:
            c.setFont(base_font, current_size)
            text_width = c.stringWidth(text, base_font, current_size)
            if text_width <= max_width:
                return current_size
            current_size -= 0.5
        return min_size

    def draw_single_label(self, c, x, y, card_data):
        """Draw a single label following exact specifications for fold-over magnetic case"""
        try:
            # Label boundaries with 0.05" margin
            label_x = x + 0.05 * inch
            label_y = y + 0.05 * inch
            usable_width = self.label_width - 0.1 * inch  # Account for margins
            usable_height = self.label_height - 0.1 * inch

            # === 1. WEBSITE URL (TOP SECTION - UPSIDE DOWN) ===
            top_section_y = label_y + usable_height - 0.2 * inch

            # URL text (upside down, at very top)
            c.saveState()
            url_text = "www.DCMGrading.com"
            url_font_size = 5
            c.setFont("Helvetica", url_font_size)
            c.setFillColor(black)

            # Position at top center, upside down
            url_width = c.stringWidth(url_text, "Helvetica", url_font_size)
            url_x = label_x + (usable_width / 2) + (url_width / 2)
            url_y = top_section_y
            c.translate(url_x, url_y)
            c.rotate(180)
            c.drawString(0, 0, url_text)
            c.restoreState()

            # === 2. HEADER SECTION ===
            # Purple bar horizontally across label center, spanning full width
            header_height = 0.15 * inch
            header_y = label_y + (usable_height / 2) - (header_height / 2)

            c.setFillColor(self.dcm_purple)
            c.rect(label_x, header_y, usable_width, header_height, fill=1, stroke=0)

            # Header text: "DYNAMIC COLLECTIBLES MANAGEMENT"
            c.setFillColor(white)
            header_text = "DYNAMIC COLLECTIBLES MANAGEMENT"
            header_font_size = self.get_dynamic_font_size(c, header_text, usable_width - 0.1*inch, "Helvetica-Bold", 7, 5)
            c.setFont("Helvetica-Bold", header_font_size)
            text_width = c.stringWidth(header_text, "Helvetica-Bold", header_font_size)
            text_x = label_x + (usable_width - text_width) / 2
            text_y = header_y + (header_height / 2) - (header_font_size / 2 * 0.75)
            c.drawString(text_x, text_y, header_text)

            # === 3. MAIN CONTENT SECTION (BELOW HEADER) ===
            bottom_section_y = label_y + 0.1 * inch
            bottom_section_height = header_y - bottom_section_y - 0.05 * inch

            # DCM Logo (0.4" × 0.4") - positioned higher in the section
            logo_size = 0.4 * inch
            logo_x = label_x + 0.05 * inch
            logo_y = bottom_section_y + bottom_section_height - logo_size - 0.05 * inch

            try:
                # Try to use the actual DCM logo
                c.drawInlineImage("DCM-logo.png", logo_x, logo_y, logo_size, logo_size)
            except:
                # Fallback to text if logo file not found
                c.setStrokeColor(self.dcm_purple)
                c.setLineWidth(1.5)
                c.rect(logo_x, logo_y, logo_size, logo_size, fill=0, stroke=1)
                c.setFillColor(self.dcm_purple)
                c.setFont("Helvetica-Bold", 12)
                dcm_width = c.stringWidth("DCM", "Helvetica-Bold", 12)
                c.drawString(logo_x + (logo_size - dcm_width)/2, logo_y + logo_size/2 - 6, "DCM")

            # === 4. GRADE SECTION (BOTTOM RIGHT) ===
            # Moved down closer to bottom while maintaining edge for printing
            grade_x = label_x + usable_width - 0.25 * inch
            grade_y = bottom_section_y + 0.15 * inch  # Closer to bottom but with margin

            # Numeric Grade - Montserrat ExtraBold, ~18pt, purple #4B2E83
            grade_score = str(card_data.get('grade_score', '?'))
            c.setFillColor(self.dcm_purple)
            c.setFont("Helvetica-Bold", 18)
            grade_width = c.stringWidth(grade_score, "Helvetica-Bold", 18)
            c.drawString(grade_x - grade_width/2, grade_y + 0.12 * inch, grade_score)

            # Horizontal Divider Line (same distance below grade as grade is above line)
            line_spacing = 0.05 * inch  # Consistent spacing
            line_y = grade_y + 0.12 * inch - line_spacing
            c.setStrokeColor(self.dcm_purple)
            c.setLineWidth(1)
            c.line(grade_x - grade_width/2, line_y, grade_x + grade_width/2, line_y)

            # Letter Grade - same distance below line as line is below grade
            grade_letter = card_data.get('grade_letter', 'C')
            c.setFillColor(self.dcm_purple)
            c.setFont("Helvetica-Bold", 8)
            letter_width = c.stringWidth(grade_letter, "Helvetica-Bold", 8)
            c.drawString(grade_x - letter_width/2, line_y - line_spacing, grade_letter)

            # === 5. CARD INFORMATION (BOTTOM LEFT) ===
            # Move all card info to bottom of label
            text_x = logo_x
            text_area_width = usable_width - 0.5 * inch  # Leave space for grade
            text_bottom_y = bottom_section_y + 0.05 * inch

            # Calculate vertical spacing for 3 lines of text from bottom up
            line_height = 0.08 * inch

            # 3. Serial Number (bottom line)
            serial = card_data.get('serial', 'No Serial')
            c.setFillColor(self.dcm_gray)
            c.setFont("Helvetica", 5)
            c.drawString(text_x, text_bottom_y, serial)

            # 2. Card Set, Year (middle line)
            card_set_year = f"{card_data.get('card_set', 'Unknown Set')}, {card_data.get('year', '2024')}"
            set_font_size = self.get_dynamic_font_size(c, card_set_year, text_area_width, "Helvetica-Bold", 6, 5)
            c.setFillColor(black)
            c.setFont("Helvetica-Bold", set_font_size)
            c.drawString(text_x, text_bottom_y + line_height, card_set_year)

            # 1. Player Name (top line)
            card_name = card_data.get('card_name', 'Unknown Card')
            name_font_size = self.get_dynamic_font_size(c, card_name, text_area_width, "Helvetica-Bold", 7, 5)
            c.setFillColor(black)
            c.setFont("Helvetica-Bold", name_font_size)
            c.drawString(text_x, text_bottom_y + 2 * line_height, card_name)

            # === 6. QR CODE (CENTER LEFT) ===
            # QR Code positioned in the middle left area
            qr_size = 0.3 * inch  # Slightly smaller to fit better
            serial_number = card_data.get('serial', card_data.get('id', 'unknown'))
            qr_url = f"https://dcmgrading.com/card/{serial_number}"
            qr_file_path = self.generate_qr_code(qr_url, qr_size)

            qr_x = logo_x + logo_size + 0.1 * inch
            qr_y = (header_y + bottom_section_y + 3 * line_height) / 2 - qr_size/2
            c.drawInlineImage(qr_file_path, qr_x, qr_y, qr_size, qr_size)

            # Clean up QR temp file
            try:
                os.unlink(qr_file_path)
            except:
                pass

            logger.info(f"Successfully drew updated label for card: {card_name}")

        except Exception as e:
            logger.error(f"Error drawing updated label: {str(e)}")
            raise

    def generate_label_sheet(self, card_data):
        """Generate a full Avery sheet with one card label"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)

        try:
            # Draw the single card label in the first position (top-left)
            x = self.margin_left
            y = letter[1] - self.margin_top - self.label_height

            self.draw_single_label(c, x, y, card_data)

            # Optionally draw template grid lines for reference
            self.draw_template_grid(c)

            c.save()
            buffer.seek(0)

            logger.info("Successfully generated single label sheet")
            return buffer

        except Exception as e:
            logger.error(f"Error generating label sheet: {str(e)}")
            raise

    def generate_full_sheet(self, cards_data):
        """Generate a full Avery sheet with multiple cards (3x6 = 18 labels max)"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)

        try:
            # Draw up to 18 cards (3 cols x 6 rows)
            cards_to_draw = cards_data[:18]  # Limit to sheet capacity

            for i, card_data in enumerate(cards_to_draw):
                row = i // self.cols
                col = i % self.cols

                # Calculate position
                x = self.margin_left + col * (self.label_width + self.col_spacing)
                y = letter[1] - self.margin_top - (row + 1) * self.label_height - row * self.row_spacing

                self.draw_single_label(c, x, y, card_data)

            # Draw template grid for reference
            self.draw_template_grid(c)

            c.save()
            buffer.seek(0)

            logger.info(f"Successfully generated full sheet with {len(cards_to_draw)} labels")
            return buffer

        except Exception as e:
            logger.error(f"Error generating full sheet: {str(e)}")
            raise

    def draw_template_grid(self, c):
        """Draw light grid lines showing all label positions"""
        c.setStrokeColor(Color(0.8, 0.8, 0.8))  # Light gray
        c.setLineWidth(0.5)

        for row in range(self.rows):
            for col in range(self.cols):
                x = self.margin_left + col * (self.label_width + self.col_spacing)
                y = letter[1] - self.margin_top - (row + 1) * self.label_height - row * self.row_spacing

                # Draw rectangle outline
                c.rect(x, y, self.label_width, self.label_height, fill=0, stroke=1)

# Initialize generator
label_generator = AveryLabelGenerator()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "Label Generator"})

@app.route('/generate-label', methods=['POST'])
def generate_label():
    """Generate a single card label on Avery 6871 template"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['id', 'card_name', 'card_set', 'grade_score', 'grade_letter']
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            return jsonify({"error": f"Missing required fields: {missing_fields}"}), 400

        logger.info(f"Generating label for card: {data.get('card_name')}")

        # Generate the label sheet
        pdf_buffer = label_generator.generate_label_sheet(data)

        # Return PDF file
        filename = f"DCM_Label_{data.get('id', 'unknown')}.pdf"

        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logger.error(f"Label generation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate-full-sheet', methods=['POST'])
def generate_full_sheet():
    """Generate a full sheet with multiple cards (up to 18 cards)"""
    try:
        data = request.get_json()
        cards_data = data.get('cards', [])

        if not cards_data:
            return jsonify({"error": "No cards data provided"}), 400

        # Validate that each card has required fields
        required_fields = ['id', 'card_name', 'card_set', 'grade_score', 'grade_letter']
        for i, card_data in enumerate(cards_data):
            missing_fields = [field for field in required_fields if not card_data.get(field)]
            if missing_fields:
                return jsonify({"error": f"Card {i+1} missing fields: {missing_fields}"}), 400

        logger.info(f"Generating full sheet for {len(cards_data)} cards")

        # Generate the full sheet
        pdf_buffer = label_generator.generate_full_sheet(cards_data)

        # Return PDF file
        filename = f"DCM_Full_Sheet_{len(cards_data)}_labels.pdf"

        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logger.error(f"Full sheet generation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Dynamic Card Label Generator Service")
    print("Health check: http://localhost:5002/health")
    print("Single label API: http://localhost:5002/generate-label")
    print("Full sheet API: http://localhost:5002/generate-full-sheet")
    app.run(host='0.0.0.0', port=5002, debug=True)