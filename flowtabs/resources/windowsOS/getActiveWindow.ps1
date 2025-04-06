[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WindowInfo {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
"@

$handle = [WindowInfo]::GetForegroundWindow()
$buffer = New-Object System.Text.StringBuilder 256
[WindowInfo]::GetWindowText($handle, $buffer, $buffer.Capacity) | Out-Null
$buffer.ToString()