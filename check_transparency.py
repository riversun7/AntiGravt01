
from PIL import Image
import sys

try:
    img_path = "/Users/ks-m1pro/Coding/AntiGravt01/terra-client/public/assets/buildings/COMMAND_CENTER.png"
    img = Image.open(img_path)
    
    print(f"Format: {img.format}")
    print(f"Mode: {img.mode}")
    
    if img.mode != 'RGBA':
        print("Image does NOT have an alpha channel.")
    else:
        print("Image HAS an alpha channel.")
        
        # Check corner pixels for transparency
        corners = [
            (0, 0),
            (img.width - 1, 0),
            (0, img.height - 1),
            (img.width - 1, img.height - 1)
        ]
        
        print("Checking corners:")
        for x, y in corners:
            pixel = img.getpixel((x, y))
            print(f"Pixel at ({x}, {y}): {pixel}")
            if pixel[3] != 0:
                print("WARNING: Corner pixel is NOT transparent!")
            else:
                print("Corner pixel IS transparent.")

except Exception as e:
    print(f"Error: {e}")
