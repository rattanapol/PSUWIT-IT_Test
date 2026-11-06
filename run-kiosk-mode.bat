@echo off
chcp 65001 >nul
title PSU WIT - Kiosk Exam Launcher
echo ======================================================================
echo    ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ - โรงเรียน ม.อ. วิทยานุสรณ์
echo            โหมดสอบเข้มงวดระดับห้องปฏิบัติการ (Kiosk Mode)
echo ======================================================================
echo.
echo กำลังเปิดโปรแกรมในโหมดล็อกหน้าจอสอบ 100% (Kiosk Exam Mode)...
echo (โหมดนี้จะซ่อน Taskbar, แถบเครื่องมือเบราว์เซอร์ และป้องกันการเปิดหน้าต่างอื่น)
echo.

set "EXAM_URL=https://rattanapol.github.io/PSUWIT-IT_Test/"

:: ตรวจสอบ Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk --disable-pinch --overscroll-history-navigation=0 "%EXAM_URL%"
    goto :done
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk --disable-pinch --overscroll-history-navigation=0 "%EXAM_URL%"
    goto :done
)

:: หากไม่มี Chrome ให้เปิดด้วย Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk "%EXAM_URL%" --edge-kiosk-type=fullscreen
    goto :done
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --kiosk "%EXAM_URL%" --edge-kiosk-type=fullscreen
    goto :done
)

echo [!] ไม่พบ Google Chrome หรือ Microsoft Edge ในเครื่อง กรุณาเปิดผ่านเบราว์เซอร์ปกติ
pause

:done
exit

