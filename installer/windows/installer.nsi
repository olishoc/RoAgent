Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Name "StudioLink"
OutFile "StudioLinkSetup.exe"
InstallDir "$LOCALAPPDATA\Programs\StudioLink"
RequestExecutionLevel user

!define DAEMON_PORT "45678"
!define RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioLink"

Var DeleteData

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
UninstPage custom un.DeleteDataPage un.DeleteDataPageLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install StudioLink" SEC01
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "..\..\dist\studiolink-daemon.exe"
  SetOutPath "$INSTDIR\roagent"
  File "..\..\dist\roagent.exe"
  SetOutPath "$INSTDIR\scripts"
  File "api-key-setup.ps1"
  File "health-check.ps1"
  File "..\shared\health-check.js"

  DetailPrint "Creating Start Menu shortcuts"
  CreateDirectory "$SMPROGRAMS\StudioLink"
  CreateShortcut "$SMPROGRAMS\StudioLink\StudioLink Daemon.lnk" "$INSTDIR\studiolink-daemon.exe" "" "$INSTDIR\studiolink-daemon.exe" 0
  CreateShortcut "$SMPROGRAMS\StudioLink\RoAgent.lnk" "$INSTDIR\roagent\roagent.exe" "" "$INSTDIR\roagent\roagent.exe" 0
  CreateShortcut "$SMPROGRAMS\StudioLink\Uninstall StudioLink.lnk" "$INSTDIR\Uninstall.exe"

  DetailPrint "Enabling per-user autostart"
  WriteRegStr HKCU "${RUN_KEY}" "StudioLink" '"$INSTDIR\studiolink-daemon.exe"'

  DetailPrint "Registering uninstaller"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "StudioLink"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "3.0.0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "RblxAgent"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1

  DetailPrint "Starting StudioLink daemon"
  Exec '"$INSTDIR\studiolink-daemon.exe"'

  MessageBox MB_YESNO "Configure your AI API key now? Choose No to skip for now." IDNO skip_api
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\scripts\api-key-setup.ps1" -Port ${DAEMON_PORT}'
  skip_api:

  DetailPrint "Running post-install health check"
  Sleep 1500
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\health-check.ps1" -Port ${DAEMON_PORT}'
SectionEnd

Function un.DeleteDataPage
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateCheckbox} 0 0 100% 12u "Also delete my data in %APPDATA%\StudioLink"
  Pop $DeleteData
  nsDialogs::Show
FunctionEnd

Function un.DeleteDataPageLeave
  ${NSD_GetState} $DeleteData $DeleteData
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  DetailPrint "Stopping StudioLink daemon if it is running"
  nsExec::ExecToLog 'taskkill /IM studiolink-daemon.exe /F'
  DeleteRegValue HKCU "${RUN_KEY}" "StudioLink"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  Delete "$SMPROGRAMS\StudioLink\StudioLink Daemon.lnk"
  Delete "$SMPROGRAMS\StudioLink\RoAgent.lnk"
  Delete "$SMPROGRAMS\StudioLink\Uninstall StudioLink.lnk"
  RMDir "$SMPROGRAMS\StudioLink"
  RMDir /r "$INSTDIR"
  ${If} $DeleteData == ${BST_CHECKED}
    RMDir /r "$APPDATA\StudioLink"
  ${EndIf}
SectionEnd
