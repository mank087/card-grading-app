@echo off
echo ========================================
echo  DCM Card Grading - OpenCV Service
echo ========================================
echo.

REM Use the full path to Python 3.13
set PYTHON_PATH=C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe

echo Checking Python installation...
%PYTHON_PATH% --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found at %PYTHON_PATH%
    pause
    exit /b 1
)

echo.
echo Installing/updating dependencies...
%PYTHON_PATH% -m pip install --upgrade pip
%PYTHON_PATH% -m pip install -r requirements.txt

echo.
echo Starting OpenCV Service on http://localhost:5001...
echo.
echo Press Ctrl+C to stop the service
echo ========================================
echo.

%PYTHON_PATH% app.py

pause
