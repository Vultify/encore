; Uninstalling also turns off Start with Windows, so Windows doesn't try to open a removed app at every sign-in.
; Electron saves that entry under the app's ID. An update removes the old version only to put the new one in its
; place, so the entry stays then.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.vultify.encore"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "com.vultify.encore"
  ${endIf}
!macroend
