@echo off
echo 🚀 Installing Enhanced Card Detection Service...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✅ Installation complete!
echo.
echo 🚀 Starting Enhanced Card Detection Service...
echo 📍 Health check: http://localhost:5001/health
echo 📍 Detection API: http://localhost:5001/detect
echo.
echo Press Ctrl+C to stop the service
echo.

REM Start the service
python app.py