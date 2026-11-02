Option Explicit
Dim shell, fso, command, i
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
shell.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
command = ""
For i = 0 To WScript.Arguments.Count - 1
  If i > 0 Then command = command & " "
  command = command & QuoteArg(WScript.Arguments(i))
Next
WScript.Quit shell.Run(command, 0, True)

Function QuoteArg(value)
  Dim result, slashes, j, ch
  result = Chr(34)
  slashes = 0
  For j = 1 To Len(value)
    ch = Mid(value, j, 1)
    If ch = "\" Then
      slashes = slashes + 1
    Else
      If ch = Chr(34) Then
        result = result & String(slashes * 2 + 1, "\") & ch
      Else
        result = result & String(slashes, "\") & ch
      End If
      slashes = 0
    End If
  Next
  QuoteArg = result & String(slashes * 2, "\") & Chr(34)
End Function
