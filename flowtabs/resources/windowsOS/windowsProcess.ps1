[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
  using System;
  using System.Collections.Generic;
  using System.Diagnostics;
  using System.Runtime.InteropServices;
  using System.Text;

  public class Window {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern IntPtr GetShellWindow();

    [DllImport("user32.dll")]
    static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

    [DllImport("user32.dll", SetLastError = true)]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    const uint GA_ROOTOWNER = 3;
    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int WS_EX_NOACTIVATE = 0x08000000;

    public static List<Dictionary<string, string>> GetOpenWindows() {
      var windows = new List<Dictionary<string, string>>();
      IntPtr shellWindow = GetShellWindow();
      string[] excludedProcesses = { "ApplicationFrameHost", "TextInputHost", "SystemSettings" };

      EnumWindows((hWnd, lParam) => {
        if (hWnd == shellWindow) return true; // Ignore shell window
        if (!IsWindowVisible(hWnd)) return true; // Ignore invisible windows

        // Checks if the window is main (not a child)
        if (GetAncestor(hWnd, GA_ROOTOWNER) != hWnd) return true;

        // Checks whether the window is a ToolWindow or a non-activatable window
        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
        if ((exStyle & WS_EX_TOOLWINDOW) != 0 || (exStyle & WS_EX_NOACTIVATE) != 0) return true;

        // Checks window class name to exclude known types
        var className = new StringBuilder(256);
        GetClassName(hWnd, className, 256);
        if (className.ToString() == "ApplicationFrameWindow") return true; // Excludes hosted windows

        // Window title retrieval
        var title = new StringBuilder(256);
        GetWindowText(hWnd, title, 256);
        if (title.Length == 0) return true; // Excludes untitled windows

        // Process recovery
        uint processId;
        GetWindowThreadProcessId(hWnd, out processId);
        Process process;

        try
        {
          process = Process.GetProcessById((int)processId);
        }
        catch {
          return true; // Ignores processes that are no longer active
        }

        // Exclude known background processes
        if (Array.Exists(excludedProcesses, element => element.Equals(process.ProcessName, StringComparison.OrdinalIgnoreCase)))
          return true;

        string exePath;
        try {
          exePath = process.MainModule.FileName;
        } catch {
          return true; // If the path cannot be accessed, this window is ignored
        }


        // Adds only windows that pass filters
        var window = new Dictionary<string, string>
        {
          { "id", hWnd.ToString() },
          { "processName", process.ProcessName },
          { "title", title.ToString() },
          { "exePath", exePath }
        };

        windows.Add(window);
        return true;
      }, IntPtr.Zero);

      return windows;
    }
  }
"@

# Retrieve windows and return them as JSON without Newtonsoft
$windows = [Window]::GetOpenWindows()

# Convert to JSON using PowerShell's native method
$windows | ConvertTo-Json -Depth 3
