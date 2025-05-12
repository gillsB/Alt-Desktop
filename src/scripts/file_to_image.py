from icoextract import IconExtractor, IconExtractorError
from PIL import Image
import sys


def file_to_image(exe_path, output_path, icon_size):
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

def main():
    if len(sys.argv) != 4:
        print("Usage: python file_to_image.py <exe_path> <output_path> <icon_size>")
        sys.exit(1)

    exe_path = sys.argv[1]
    output_path = sys.argv[2]
    try:
        icon_size = int(sys.argv[3])
    except ValueError:
        print("Invalid icon size.")
        sys.exit(1)

    result = file_to_image(exe_path, output_path, icon_size)
    if result:
        print(result)
        sys.exit(0)
    else:
        sys.exit(2)

if __name__ == "__main__":
    main()