Option Explicit
Dim shell, fso, launcher
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
launcher = fso.GetParentFolderName(WScript.ScriptFullName) & "\install-autostart.vbs"
WScript.Quit shell.Run("wscript.exe " & Chr(34) & launcher & Chr(34) & " uninstall", 0, True)
