@echo off
REM VibeShield - Build script for Windows

echo Building VibeShield Bridge...
echo.

REM Create bin directory if it doesn't exist
if not exist bin mkdir bin

REM Build for current platform (Windows)
echo Building for Windows...
go build -o bin\bridge.exe bridge.go
echo    Done: bin\bridge.exe

echo.
echo Build complete!
echo.
echo Test with:
echo   bin\bridge.exe test_file.js