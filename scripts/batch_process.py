import os
import sys
from PIL import Image, ImageFilter
import numpy as np

def enhance_map_resolution(image_path, scale_factor=2):
    """Enhances map resolution by upscaling with proper interpolation."""
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return None

    try:
        img = Image.open(image_path)
        
        # Get original dimensions
        width, height = img.size
        new_width = width * scale_factor
        new_height = height * scale_factor
        
        # Resize using high-quality resampling
        enhanced_img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Apply slight sharpening to counteract softening from upscaling
        enhanced_img = enhanced_img.filter(ImageFilter.UnsharpMask(radius=1, percent=100, threshold=0))
        
        return enhanced_img
    except Exception as e:
        print(f"Error enhancing map resolution: {e}")
        return None

def batch_enhance_tiles(base_path, output_dir, prefix, rows, cols, scale_factor=2):
    """Enhances all tiles in a grid pattern."""
    enhanced_paths = []
    
    for r in range(rows):
        for c in range(cols):
            tile_path = os.path.join(base_path, f"{prefix}_tile_{r}_{c}.png")
            if os.path.exists(tile_path):
                enhanced_img = enhance_map_resolution(tile_path, scale_factor)
                if enhanced_img:
                    enhanced_path = os.path.join(output_dir, f"{prefix}_tile_{r}_{c}_enhanced.png")
                    enhanced_img.save(enhanced_path)
                    enhanced_paths.append(enhanced_path)
                    print(f"Enhanced tile: {enhanced_path}")
            else:
                print(f"Warning: Tile not found: {tile_path}")
    
    return enhanced_paths

def stitch_images(tile_paths, output_path, rows, cols):
    """Stitches tiles back into a single image."""
    try:
        images = [Image.open(p) for p in tile_paths]

        # Assumption: All tiles are same size or fit grid logic.
        tile_w, tile_h = images[0].size

        # Calculate total size
        total_w = tile_w * cols
        total_h = tile_h * rows

        new_im = Image.new('RGB', (total_w, total_h))

        print(f"Stitching {len(images)} tiles into {total_w}x{total_h} image...")

        for r in range(rows):
            for c in range(cols):
                idx = r * cols + c
                if idx < len(images):
                    new_im.paste(images[idx], (c * tile_w, r * tile_h))

        new_im.save(output_path)
        print(f"Saved stitched image: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error stitching images: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python batch_process.py [enhance_tiles|stitch_tiles] [args...]")
        print("  enhance_tiles base_path output_dir prefix rows cols [scale_factor]")
        print("  stitch_tiles output_path tile1 tile2 ... rows cols")
        sys.exit(1)

    command = sys.argv[1]

    if command == "enhance_tiles":
        # python batch_process.py enhance_tiles base_path output_dir prefix rows cols [scale_factor]
        base_path = sys.argv[2]
        output_dir = sys.argv[3]
        prefix = sys.argv[4]
        rows = int(sys.argv[5])
        cols = int(sys.argv[6])
        scale_factor = int(sys.argv[7]) if len(sys.argv) > 7 else 2
        
        enhanced_paths = batch_enhance_tiles(base_path, output_dir, prefix, rows, cols, scale_factor)
        print(f"Enhanced {len(enhanced_paths)} tiles")

    elif command == "stitch_tiles":
        # python batch_process.py stitch_tiles output_path tile1 tile2 ... rows cols
        output_path = sys.argv[2]
        tile_paths = sys.argv[3:-2]  # All args except last 2
        rows = int(sys.argv[-2])
        cols = int(sys.argv[-1])
        
        result = stitch_images(tile_paths, output_path, rows, cols)
        if result:
            print(f"Successfully stitched image to: {result}")