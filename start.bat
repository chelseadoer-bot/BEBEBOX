@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   BEBEBOX Server (SQLite backend)
echo  ========================================
echo.

if not exist ".env" (
  echo  [First run] Creating .env
  echo  All keys are optional - press Enter to skip.
  echo.
  set /p GEMINI_KEY="  Gemini API KEY (photo AI quest, optional): "
  echo.
  echo  Kakao Login - https://developers.kakao.com
  set /p KAKAO_KEY="  Kakao REST API Key (optional): "
  set /p KAKAO_SECRET="  Kakao Client Secret (optional): "

  echo GEMINI_API_KEY=!GEMINI_KEY!> .env
  echo KAKAO_REST_API_KEY=!KAKAO_KEY!>> .env
  echo KAKAO_CLIENT_SECRET=!KAKAO_SECRET!>> .env
  echo KAKAO_REDIRECT_URI=http://localhost:8080/auth/kakao/callback>> .env
  echo PORT=8080>> .env

  echo.
  echo  .env created (not committed to Git).
  echo  Photos/data are stored locally in data\bebebox.db + uploads\.
  echo.
)

echo  Open: http://localhost:8080
echo.
python server.py
