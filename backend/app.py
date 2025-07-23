from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image, ImageCms
import io
import os
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

SLOTS = [
    (17, 17, 266, 178),    # Slot 1
    (17, 214, 266, 178),   # Slot 2
    (17, 410, 266, 178),   # Slot 3
    (17, 604, 266, 178),  # Slot 4
]

def convert_to_srgb(img):
    """
    Enhanced color profile management with fallbacks and better error handling.
    """
    # Store original mode to preserve specialized formats
    original_mode = img.mode
    
    # Special handling for grayscale and other special modes
    if original_mode not in ('RGB', 'RGBA'):
        # Convert to RGB first to avoid profile issues
        img = img.convert('RGB')
    
    # Enhanced profile conversion
    if 'icc_profile' in img.info:
        try:
            # Extract the profile
            icc_profile = img.info.get('icc_profile')
            
            # Create sRGB profile
            srgb_profile = ImageCms.createProfile('sRGB')
            
            # Determine appropriate output mode
            target_mode = 'RGBA' if original_mode == 'RGBA' or 'transparency' in img.info else 'RGB'
            
            # Convert with explicit intent and flags for better quality
            img = ImageCms.profileToProfile(
                img, 
                icc_profile, 
                srgb_profile,
                outputMode=target_mode,
                renderingIntent=ImageCms.INTENT_RELATIVE_COLORIMETRIC,
                flags=0
            )
            print(f"Converted image from ICC profile to sRGB")
        except Exception as e:
            print(f"ICC profile conversion failed, using standard conversion: {e}")
            img = img.convert('RGBA')
    else:
        # Convert to RGBA preserving alpha if present
        img = img.convert('RGBA')
    
    return img

def fit_image_to_slot(img, slot_w, slot_h, sharpen=True, upscale_if_small=True, target_dpi=300):
    """
    Fit image to slot with high quality resizing, optional sharpening and upscaling.
    
    Args:
        img: PIL Image object
        slot_w: Width of the target slot
        slot_h: Height of the target slot
        sharpen: Whether to apply sharpening filter after resize
        upscale_if_small: Whether to upscale images that are smaller than the slot
        target_dpi: Target DPI (dots per inch) for output image
    
    Returns:
        PIL Image object fitted to the slot dimensions with preserved DPI
    """
    # Preserve original DPI info if available
    dpi_info = img.info.get('dpi', (target_dpi, target_dpi))
    # Check if image needs upscaling (if it's smaller than the slot)
    if upscale_if_small and (img.width < slot_w or img.height < slot_h):
        scale_factor = max(slot_w / img.width, slot_h / img.height)
        if scale_factor > 1:
            # Upscale image using BICUBIC for better quality when enlarging
            upscale_width = int(img.width * scale_factor)
            upscale_height = int(img.height * scale_factor)
            img = img.resize((upscale_width, upscale_height), Image.BICUBIC)
    
    # Calculate dimensions to maintain aspect ratio
    img_ratio = img.width / img.height
    slot_ratio = slot_w / slot_h
    
    if img_ratio > slot_ratio:
        new_height = slot_h
        new_width = int(slot_h * img_ratio)
    else:
        new_width = slot_w
        new_height = int(slot_w / img_ratio)
    
    # For multi-step resizing to preserve more detail
    if img.width > new_width * 2 or img.height > new_height * 2:
        # For large downsampling, do it in steps for better quality
        intermediate_w = min(img.width, new_width * 2)
        intermediate_h = min(img.height, new_height * 2)
        img = img.resize((intermediate_w, intermediate_h), Image.LANCZOS)
    
    # High-quality resize with LANCZOS
    img = img.resize((new_width, new_height), Image.LANCZOS)
    
    # Apply sharpening if requested
    if sharpen:
        from PIL import ImageFilter, ImageEnhance
        
        # Apply unsharp mask for better sharpening
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=150, threshold=3))
        
        # Additional sharpness enhancement
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.3)  # Value of 1.3 gives good results
    
    # Crop to exact dimensions
    left = (new_width - slot_w) // 2
    top = (new_height - slot_h) // 2
    right = left + slot_w
    bottom = top + slot_h
    img = img.crop((left, top, right, bottom))
    
    # Set the DPI information explicitly on the image
    if 'dpi' not in img.info or img.info['dpi'] != (target_dpi, target_dpi):
        img.info['dpi'] = (target_dpi, target_dpi)
    
    return img

@app.route('/generate', methods=['POST'])
def generate():
    print("Received /generate POST request")
    if 'template' not in request.files:
        return jsonify({'error': 'No template uploaded'}), 400
        
    template_file = request.files['template']
    
    # Open template with high quality settings
    template = convert_to_srgb(Image.open(template_file))
    
    # Set template DPI to 300 if not already set
    template.info['dpi'] = template.info.get('dpi', (300, 300))
    
    # Accept up to 4 photos, some may be None
    photo_files = [request.files.get(f'photo{i+1}') for i in range(4)]
    
    for idx, (slot, photo_file) in enumerate(zip(SLOTS, photo_files)):
        if photo_file:
            x, y, w, h = slot
            
            # Open image and convert to RGBA for high-quality processing
            img = convert_to_srgb(Image.open(photo_file))
            
            # Apply our enhanced fitting algorithm with 300 DPI
            img = fit_image_to_slot(img, w, h, sharpen=False, upscale_if_small=True, target_dpi=300)
            
            # Use proper alpha-aware pasting
            template.paste(img, (x, y), img)
    
    # Save with high quality settings
    output = io.BytesIO()
    
    # PNG gives best quality but larger file size
    template.save(
        output, 
        format='PNG', 
        compress_level=0,  # No compression for maximum quality
        dpi=(300, 300)     # Explicitly set 300 DPI
    )
    
    output.seek(0)
    return send_file(output, mimetype='image/png')

@app.route('/save_locally', methods=['POST'])
def save_locally():
    print("Received /save_locally POST request")
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    
    # Create a directory for saving generated images if it doesn't exist
    save_dir = os.path.join(os.path.dirname(__file__), 'generated_frames')
    os.makedirs(save_dir, exist_ok=True)
    
    # Generate a unique filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"frame_{timestamp}.png"
    filepath = os.path.join(save_dir, filename)
    
    # Save the image locally with high quality and 300 DPI
    img = convert_to_srgb(Image.open(file))
    img.save(
        filepath, 
        format='PNG', 
        compress_level=0,  # No compression for maximum quality
        dpi=(300, 300)     # Explicitly set 300 DPI
    )
    
    print(f"Saved generated frame to: {filepath}")
    return jsonify({'success': True, 'filepath': filepath})

# --- Proxy upload endpoint for gofile.io sharing ---
@app.route('/upload_temp', methods=['POST'])
def upload_temp():
    print("Received /upload_temp POST request")
    if 'file' not in request.files:
        print("No file found in request.files")
        return jsonify({'success': False, 'error': 'No file uploaded'}), 400
    file = request.files['file']
    print(f"Uploading file: {file.filename}, type: {file.mimetype}")
    # The key must be 'file', not 'files'
    files = {'file': (file.filename, file.stream, file.mimetype)}
    try:
        res = requests.post('https://upload.gofile.io/uploadfile', files=files)
        print(f"gofile.io response status: {res.status_code}")
        print(f"gofile.io response text: {res.text}")
        if res.status_code == 200:
            try:
                data = res.json()
                print("Parsed JSON from gofile.io:", data)
                # The link is in data['data']['downloadPage']
                if data.get('status') == 'ok' and 'data' in data and 'downloadPage' in data['data']:
                    return jsonify({'success': True, 'link': data['data']['downloadPage']}), 200
                else:
                    return jsonify({'success': False, 'error': data}), 500
            except Exception as e:
                print(f"Failed to parse JSON from gofile.io: {e}")
                return jsonify({'success': False, 'error': 'gofile.io did not return JSON', 'raw': res.text}), 500
        else:
            return jsonify({'success': False, 'error': res.text}), res.status_code
    except Exception as e:
        print(f"Exception during upload to gofile.io: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
