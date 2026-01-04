
import os
import sys
from PIL import Image

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
        # We take first tile to judge size, but handle variable size if needed.
        # Ideally tiles are uniform from the upscale process.
        
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
    if len(sys.argv) < 2:
        print("Usage: python map_tiler.py [split|stitch] [input_path/output_path] [args...]")
        sys.exit(1)

    command = sys.argv[1]
    
    if command == "split":
        # python map_tiler.py split image.png [rows] [cols]
        img_path = sys.argv[2]
        r = int(sys.argv[3]) if len(sys.argv) > 3 else 2
        c = int(sys.argv[4]) if len(sys.argv) > 4 else 2
        split_image(img_path, r, c)
        
    elif command == "stitch":
        # python map_tiler.py stitch output.png tile0.png tile1.png ...
        out_path = sys.argv[2]
        tiles = sys.argv[3:]
        # Calculate rows/cols from len(tiles). Default 2x2 = 4 tiles.
        # If 4 tiles -> 2x2. If 16 -> 4x4.
        count = len(tiles)
        grid_side = int(count ** 0.5)
        stitch_images(tiles, out_path, grid_side, grid_side)
