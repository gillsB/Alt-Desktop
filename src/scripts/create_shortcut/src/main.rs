use std::env;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;

use windows::{
    core::*,
    Win32::System::Com::*,
    Win32::UI::Shell::*,
};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: create_shortcut.exe <targetPath> <shortcutPath>");
        std::process::exit(1);
    }

    let target_path = &args[1];
    let shortcut_path = &args[2];

    unsafe {
        CoInitializeEx(Some(ptr::null()), COINIT_APARTMENTTHREADED)?;

        let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;

        shell.SetPath(&HSTRING::from(target_path))?;

        let working_dir = std::path::Path::new(target_path)
            .parent()
            .unwrap_or_else(|| std::path::Path::new(""));
        shell.SetWorkingDirectory(&HSTRING::from(working_dir.to_string_lossy().as_ref()))?;

        // Cast to IPersistFile interface
        let persist_file: IPersistFile = shell.cast()?;

        let shortcut_wide: Vec<u16> = OsStr::new(shortcut_path)
            .encode_wide()
            .chain(Some(0))
            .collect();

        persist_file.Save(PCWSTR(shortcut_wide.as_ptr()), true)?;

        CoUninitialize();
    }

    Ok(())
}
