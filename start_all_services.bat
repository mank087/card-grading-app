@echo off
echo ========================================
echo  DCM Card Grading - Full Stack Startup
echo ========================================
echo.

REM Set Python path
set PYTHON_PATH=C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe

echo [1/2] Starting OpenCV Service...
echo.
start "OpenCV Service - Port 5001" cmd /k "cd card_detection_service && %PYTHON_PATH% app.py"

echo Waiting for OpenCV service to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting Next.js Application...
echo.
start "Next.js Dev Server - Port 3000" cmd /k "npm run dev"

echo.
echo ========================================
echo  ✅ All Services Started!
echo ========================================
echo.
echo OpenCV Service: http://localhost:5001/health
echo Next.js App:     http://localhost:3000
echo.
echo Close this window when you're done.
echo Press any key to test OpenCV service...
pause > nul

echo.
echo Testing OpenCV service...
curl http://localhost:5001/health

echo.
echo.
echo If you see a JSON response above, OpenCV is running!
echo.
pause
