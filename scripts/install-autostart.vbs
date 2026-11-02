Option Explicit
Dim shell, fso, root, script, result, mode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
mode = "install"
If WScript.Arguments.Count > 0 Then mode = WScript.Arguments(0)
If mode <> "install" And mode <> "uninstall" Then WScript.Quit 1
script = root & "\" & mode & "-autostart.ps1"
result = shell.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & script & Chr(34), 0, True)
If result = 0 Then
 shell.Popup "ATracker helper " & mode & " complete.", 0, "ATracker", 64
Else
 shell.Popup "ATracker helper " & mode & " failed. Ask the setup maintainer to check Node.js, dependencies and Task Scheduler permissions.", 0, "ATracker", 16
End If
WScript.Quit result
