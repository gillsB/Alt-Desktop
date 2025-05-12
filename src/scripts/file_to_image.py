import ctypes
from ctypes import wintypes
from icoextract import IconExtractor, IconExtractorError
from PIL import Image
import sys

# Constants for SHGetFileInfo function
SHGFI_ICON = 0x000000100
SHGFI_LARGEICON = 0x000000000  # Large icon
SHGFI_SMALLICON = 0x000000001  # Small icon
SHGFI_USEFILEATTRIBUTES = 0x000000010  # Retrieve icon based on file attributes

class SHFILEINFO(ctypes.Structure):
    _fields_ = [("hIcon", wintypes.HICON),
                ("iIcon", wintypes.INT),
                ("dwAttributes", wintypes.DWORD),
                ("szDisplayName", wintypes.WCHAR * 260),
                ("szTypeName", wintypes.WCHAR * 80)]
    
class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [("biSize", wintypes.DWORD),
                ("biWidth", wintypes.LONG),
                ("biHeight", wintypes.LONG),
                ("biPlanes", wintypes.WORD),
                ("biBitCount", wintypes.WORD),
                ("biCompression", wintypes.DWORD),
                ("biSizeImage", wintypes.DWORD),
                ("biXPelsPerMeter", wintypes.LONG),
                ("biYPelsPerMeter", wintypes.LONG),
                ("biClrUsed", wintypes.DWORD),
                ("biClrImportant", wintypes.DWORD)]

class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER),
                ("bmiColors", wintypes.DWORD * 3)]

# Load the required libraries
shell32 = ctypes.windll.shell32
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

def exe_to_image(exe_path, output_path, icon_size):
    print(f"Called with arguments: exe_path = {exe_path}, output_path = {output_path}, icon_size = {icon_size}")
    try:
        extractor = IconExtractor(exe_path)
        data = extractor.get_icon(num=0)
        im = Image.open(data)
        img_resized = im.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        img_resized.save(output_path)
        print(f"Icon saved to: {output_path}")
        return output_path
    except IconExtractorError as e:
        print(f"IconExtractorError: {e}")
    except Exception as e:
        print(f"Error: {e}")
    return None

def default_icon_to_image(file_path, output_path, icon_size, retries=5):
    
    def get_icon_handle():
        shfileinfo = SHFILEINFO()
        flags = SHGFI_ICON | SHGFI_LARGEICON | SHGFI_USEFILEATTRIBUTES
        res = shell32.SHGetFileInfoW(file_path, 0, ctypes.byref(shfileinfo), ctypes.sizeof(shfileinfo), flags)
        
        if res == 0:
            file_attributes = 0x80  # FILE_ATTRIBUTE_NORMAL
            flags |= SHGFI_USEFILEATTRIBUTES
            res = shell32.SHGetFileInfoW(file_path, file_attributes, ctypes.byref(shfileinfo), ctypes.sizeof(shfileinfo), flags)
            
            if res == 0:
                return None
        
        return shfileinfo.hIcon
    
    hicon = None
    for attempt in range(retries):
        hicon = get_icon_handle()
        if hicon and 0 <= hicon <= 2**32-1:
            break
        else:
            hicon = None

    if not hicon:
        return "assets/images/unknown.png"
        
        
    
    width, height = (32, 32)

    hdc = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc)

    hbmp = gdi32.CreateCompatibleBitmap(hdc, width, height)
    if not hbmp:
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc)
        raise ValueError("Failed to create a compatible bitmap.")

    old_bmp = gdi32.SelectObject(hdc_mem, hbmp)

    try:
        success = user32.DrawIconEx(hdc_mem, 0, 0, hicon, width, height, 0, 0, 0x0003)
        if not success:
            raise ctypes.WinError(ctypes.get_last_error())

        buffer = (ctypes.c_char * (width * height * 4))()
        bmp_info = BITMAPINFO()

        bmp_info.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmp_info.bmiHeader.biWidth = width
        bmp_info.bmiHeader.biHeight = -height
        bmp_info.bmiHeader.biPlanes = 1
        bmp_info.bmiHeader.biBitCount = 32
        bmp_info.bmiHeader.biCompression = 0  # BI_RGB

        gdi32.GetDIBits(hdc_mem, hbmp, 0, height, ctypes.byref(buffer), ctypes.byref(bmp_info), 0)

        img = Image.frombuffer('RGBA', (width, height), buffer, 'raw', 'BGRA', 0, 1)
        img_resized = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)

        img_resized.save(output_path)

    finally:
        gdi32.SelectObject(hdc_mem, old_bmp)
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc)

        if hicon and 0 <= hicon <= 2**32-1:
            try:
                user32.DestroyIcon(hicon)
            except Exception as e:
                ...

    return output_path

def main():
    if len(sys.argv) != 5:
        print("Usage: python file_to_image.py <exe_path> <output_path> <icon_size>")
        sys.exit(1)

    file_type = sys.argv[1]
    file_path = sys.argv[2]
    output_path = sys.argv[3]
    try:
        icon_size = int(sys.argv[4])
    except ValueError:
        print("Invalid icon size.")
        sys.exit(1)

    match file_type:
        case "exe":
            result = exe_to_image(file_path, output_path, icon_size)
            print("result is exe")
        case "default":
            print("result is default")
            result = default_icon_to_image(file_path, output_path, icon_size)
        case _:
            print(f"Unsupported file type: {file_type}")
            sys.exit(1)

    if result:
        print(result)
        sys.exit(0)
    else:
        sys.exit(2)

if __name__ == "__main__":
    main()