!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"

!ifndef BUILD_UNINSTALLER
Var InstallOptionsDialog
Var DesktopShortcutCheckbox
Var StartMenuShortcutCheckbox
Var AutoStartCheckbox
Var DesktopShortcutChoice
Var StartMenuShortcutChoice
Var AutoStartChoice
Var InstallModeNextX
Var InstallModeNextY
Var InstallModeNextWidth
Var InstallModeNextHeight

!define MUI_PAGE_CUSTOMFUNCTION_SHOW ExpandInstallModeNextButton
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE RestoreInstallModeNextButton

LangString InstallOptionsTitle 1033 "Installation options"
LangString InstallOptionsTitle 2052 "安装选项"
LangString InstallOptionsSubtitle 1033 "Choose the shortcuts and startup behavior."
LangString InstallOptionsSubtitle 2052 "选择快捷方式和开机启动行为。"
LangString DesktopShortcutLabel 1033 "Create a desktop shortcut"
LangString DesktopShortcutLabel 2052 "创建桌面快捷方式"
LangString StartMenuShortcutLabel 1033 "Create a Start Menu shortcut"
LangString StartMenuShortcutLabel 2052 "创建开始菜单快捷方式"
LangString AutoStartLabel 1033 "Launch Personal Command Deck at startup"
LangString AutoStartLabel 2052 "开机时启动 Personal Command Deck"

Function ExpandInstallModeNextButton
  GetDlgItem $0 $HWNDPARENT 1
  System::Call 'USER32::GetWindowRect(pr0,@r1)'
  System::Call 'USER32::MapWindowPoints(p0,p$HWNDPARENT,pr1,i2)'
  System::Call '*$1(i.r2,i.r3,i.r4,i.r5)'
  System::Free $1

  StrCpy $InstallModeNextX $2
  StrCpy $InstallModeNextY $3
  IntOp $InstallModeNextWidth $4 - $2
  IntOp $InstallModeNextHeight $5 - $3

  IntOp $2 $2 - $InstallModeNextHeight
  IntOp $4 $InstallModeNextWidth + $InstallModeNextHeight
  System::Call 'USER32::SetWindowPos(pr0,p0,ir2,ir3,ir4,i$InstallModeNextHeight,i0x14)'
FunctionEnd

Function RestoreInstallModeNextButton
  GetDlgItem $0 $HWNDPARENT 1
  System::Call 'USER32::SetWindowPos(pr0,p0,i$InstallModeNextX,i$InstallModeNextY,i$InstallModeNextWidth,i$InstallModeNextHeight,i0x14)'
FunctionEnd

!macro customInit
  StrCpy $DesktopShortcutChoice ${BST_CHECKED}
  StrCpy $StartMenuShortcutChoice ${BST_CHECKED}
  StrCpy $AutoStartChoice ${BST_UNCHECKED}

  ClearErrors
  ReadRegDWORD $R0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "DesktopShortcutChoice"
  ${IfNot} ${Errors}
    StrCpy $DesktopShortcutChoice $R0
  ${EndIf}

  ClearErrors
  ReadRegDWORD $R0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "StartMenuShortcutChoice"
  ${IfNot} ${Errors}
    StrCpy $StartMenuShortcutChoice $R0
  ${EndIf}

  ClearErrors
  ReadRegDWORD $R0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "AutoStartChoice"
  ${IfNot} ${Errors}
    StrCpy $AutoStartChoice $R0
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page custom InstallOptionsPageCreate InstallOptionsPageLeave
!macroend

Function InstallOptionsPageCreate
  !insertmacro MUI_HEADER_TEXT "$(InstallOptionsTitle)" "$(InstallOptionsSubtitle)"

  nsDialogs::Create 1018
  Pop $InstallOptionsDialog
  ${If} $InstallOptionsDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 12u 100% 14u "$(DesktopShortcutLabel)"
  Pop $DesktopShortcutCheckbox
  ${NSD_SetState} $DesktopShortcutCheckbox $DesktopShortcutChoice

  ${NSD_CreateCheckbox} 0 42u 100% 14u "$(StartMenuShortcutLabel)"
  Pop $StartMenuShortcutCheckbox
  ${NSD_SetState} $StartMenuShortcutCheckbox $StartMenuShortcutChoice

  ${NSD_CreateCheckbox} 0 72u 100% 14u "$(AutoStartLabel)"
  Pop $AutoStartCheckbox
  ${NSD_SetState} $AutoStartCheckbox $AutoStartChoice

  nsDialogs::Show
FunctionEnd

Function InstallOptionsPageLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $DesktopShortcutChoice
  ${NSD_GetState} $StartMenuShortcutCheckbox $StartMenuShortcutChoice
  ${NSD_GetState} $AutoStartCheckbox $AutoStartChoice
FunctionEnd

!macro customInstall
  ${If} $DesktopShortcutChoice == ${BST_UNCHECKED}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${EndIf}

  ${If} $StartMenuShortcutChoice == ${BST_UNCHECKED}
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
    StrCpy $launchLink "$appExe"
  ${EndIf}

  ${If} $AutoStartChoice == ${BST_CHECKED}
    WriteRegStr SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" '$\"$appExe$\"'
  ${Else}
    DeleteRegValue SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  ${EndIf}

  WriteRegDWORD SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "DesktopShortcutChoice" $DesktopShortcutChoice
  WriteRegDWORD SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "StartMenuShortcutChoice" $StartMenuShortcutChoice
  WriteRegDWORD SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "AutoStartChoice" $AutoStartChoice
!macroend
!endif

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
!macroend
