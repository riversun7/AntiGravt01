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

def fix_antarctica_color_mismatch(image_path, output_path):
    """Fixes color mismatch in Antarctica region of realistic map."""
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return False

    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)
        
        height, width, _ = img_array.shape
        
        # Define the Antarctica region (bottom portion of the map)
        # This is approximate - Antarctica is in the bottom ~15% of the map
        antarctica_start_row = int(height * 0.85)
        
        # Get the color statistics from the left side of Antarctica
        left_region = img_array[antarctica_start_row:, :width//2, :]
        right_region = img_array[antarctica_start_row:, width//2:, :]
        
        # Calculate average colors for left and right regions
        left_avg_color = np.mean(left_region, axis=(0, 1))
        right_avg_color = np.mean(right_region, axis=(0, 1))
        
        # Adjust the right side to match the left side color
        color_ratio = left_avg_color / (right_avg_color + 1e-6)  # Add small value to avoid division by zero
        
        # Apply color correction to the right side of Antarctica
        img_array[antarctica_start_row:, width//2:, 0] = np.clip(
            img_array[antarctica_start_row:, width//2:, 0] * color_ratio[0], 0, 255
        )
        img_array[antarctica_start_row:, width//2:, 1] = np.clip(
            img_array[antarctica_start_row:, width//2:, 1] * color_ratio[1], 0, 255
        )
        img_array[antarctica_start_row:, width//2:, 2] = np.clip(
            img_array[antarctica_start_row:, width//2:, 2] * color_ratio[2], 0, 255
        )
        
        # Convert back to PIL Image
        corrected_img = Image.fromarray(img_array.astype('uint8'), 'RGB')
        corrected_img.save(output_path)
        
        print(f"Saved corrected map: {output_path}")
        return True
    except Exception as e:
        print(f"Error fixing Antarctica color mismatch: {e}")
        return False

def split_image(image_path, rows=2, cols=2):
    """Splits an image into rows*cols tiles."""
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return []

    try:
        img = Image.open(image_path)
        w, h = img.size
        tile_w = w // cols
        tile_h = h // rows

        base_name = os.path.splitext(os.path.basename(image_path))[0]
        output_dir = os.path.dirname(image_path)

        tile_paths = []

        print(f"Splitting {image_path} ({w}x{h}) into {rows}x{cols} tiles...")

        for r in range(rows):
            for c in range(cols):
                left = c * tile_w
                top = r * tile_h
                right = left + tile_w
                bottom = top + tile_h

                # Handling last tile remainder
                if c == cols - 1: right = w
                if r == rows - 1: bottom = h

                tile = img.crop((left, top, right, bottom))
                tile_filename = f"{base_name}_tile_{r}_{c}.png"
                tile_path = os.path.join(output_dir, tile_filename)
                tile.save(tile_path)
                tile_paths.append(tile_path)
                print(f"Saved tile: {tile_path}")

        return tile_paths

    except Exception as e:
        print(f"Error splitting image: {e}")
        return []

def stitch_images(tile_paths, output_path, rows=2, cols=2):
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

def enhance_tiles_resolution(tile_paths, scale_factor=2):
    """Enhances resolution of multiple tile images."""
    enhanced_paths = []
    
    for tile_path in tile_paths:
        enhanced_img = enhance_map_resolution(tile_path, scale_factor)
        if enhanced_img:
            # Create new filename for enhanced tile
            base_name = os.path.splitext(os.path.basename(tile_path))[0]
            dir_name = os.path.dirname(tile_path)
            enhanced_path = os.path.join(dir_name, f"{base_name}_enhanced.png")
            
            enhanced_img.save(enhanced_path)
            enhanced_paths.append(enhanced_path)
            print(f"Enhanced tile saved: {enhanced_path}")
    
    return enhanced_paths

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python map_enhancer.py [enhance_resolution|fix_antarctica|split|stitch] [args...]")
        print("  enhance_resolution input_path output_path [scale_factor]")
        print("  fix_antarctica input_path output_path")
        print("  split image_path rows cols")
        print("  stitch output_path tile1 tile2 ...")
        sys.exit(1)

    command = sys.argv[1]

    if command == "enhance_resolution":
        # python map_enhancer.py enhance_resolution input.png output.png [scale_factor]
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        scale_factor = int(sys.argv[4]) if len(sys.argv) > 4 else 2
        
        enhanced_img = enhance_map_resolution(input_path, scale_factor)
        if enhanced_img:
            enhanced_img.save(output_path)
            print(f"Saved enhanced image: {output_path}")

    elif command == "fix_antarctica":
        # python map_enhancer.py fix_antarctica input.png output.png
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        fix_antarctica_color_mismatch(input_path, output_path)

    elif command == "split":
        # python map_enhancer.py split image.png rows cols
        img_path = sys.argv[2]
        r = int(sys.argv[3]) if len(sys.argv) > 3 else 2
        c = int(sys.argv[4]) if len(sys.argv) > 4 else 2
        split_image(img_path, r, c)

    elif command == "stitch":
        # python map_enhancer.py stitch output.png tile1 tile2 ...
        out_path = sys.argv[2]
        tiles = sys.argv[3:]
        # Calculate rows/cols from len(tiles)
        count = len(tiles)
        grid_side = int(count ** 0.5)
        stitch_images(tiles, out_path, grid_side, grid_side)