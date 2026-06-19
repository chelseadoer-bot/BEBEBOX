@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   베베박스 (BEBEBOX) 서버 시작
echo  ========================================
echo.

if not exist ".env" (
  echo  [처음 실행] API KEY 설정이 필요합니다.
  echo.
  echo  Google AI Studio에서 Gemini API KEY를 발급받으세요:
  echo  https://aistudio.google.com/apikey
  echo.
  set /p GEMINI_KEY="  Gemini API KEY 입력: "
  if "!GEMINI_KEY!"=="" (
    echo.
    echo  API KEY가 비어 있습니다. .env.example 을 참고해 .env 파일을 직접 만들어 주세요.
    pause
    exit /b 1
  )
  echo GEMINI_API_KEY=!GEMINI_KEY!> .env
  echo PORT=8080>> .env
  echo.
  echo  .env 파일이 생성되었습니다. ^(Git에 올라가지 않습니다^)
  echo.
)

echo  종료: Ctrl+C
echo  브라우저: http://localhost:8080
echo.
python server.py
pause
