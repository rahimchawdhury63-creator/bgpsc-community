import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ImageUploaderProps {
  images: any[];
  onChange: (images: any[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ images, onChange, maxImages = 10 }: ImageUploaderProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);

    for (const file of files) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only images allowed.');
        continue;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Maximum 5MB.');
        continue;
      }

      try {
        // Upload to ImgBB via proxy
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        // Add to images array
        onChange([
          ...images,
          {
            url: data.url,
            display_url: data.display_url,
            width: data.width,
            height: data.height,
            alt: '',
            caption: '',
            sha256: '', // Would compute hash in production
          },
        ]);
      } catch (err) {
        console.error('Upload error:', err);
        alert('Failed to upload image');
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const updateImage = (index: number, updates: any) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], ...updates };
    onChange(newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    onChange(newImages);
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-outline"
          disabled={uploading || images.length >= maxImages}
        >
          {uploading ? 'Uploading...' : `Add Images (${images.length}/${maxImages})`}
        </button>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={img.url}
                alt={img.alt || `Image ${idx + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={() => setEditingIndex(idx)}
                  className="btn btn-primary text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeImage(idx)}
                  className="btn btn-secondary text-xs"
                >
                  Remove
                </button>
              </div>

              {/* Drag Handles */}
              <div className="absolute top-1 left-1 flex gap-1">
                {idx > 0 && (
                  <button
                    onClick={() => moveImage(idx, idx - 1)}
                    className="bg-white/80 rounded p-1 text-xs"
                  >
                    ←
                  </button>
                )}
                {idx < images.length - 1 && (
                  <button
                    onClick={() => moveImage(idx, idx + 1)}
                    className="bg-white/80 rounded p-1 text-xs"
                  >
                    →
                  </button>
                )}
              </div>

              {/* Alt/Caption Inputs */}
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  value={img.alt}
                  onChange={(e) => updateImage(idx, { alt: e.target.value })}
                  placeholder="Alt text"
                  className="input text-xs"
                />
                <input
                  type="text"
                  value={img.caption}
                  onChange={(e) => updateImage(idx, { caption: e.target.value })}
                  placeholder="Caption"
                  className="input text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Editor Modal */}
      {editingIndex !== null && (
        <ImageEditor
          image={images[editingIndex]}
          onSave={(updates) => {
            updateImage(editingIndex, updates);
            setEditingIndex(null);
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}

// Image Editor Component
interface ImageEditorProps {
  image: any;
  onSave: (updates: any) => void;
  onClose: () => void;
}

function ImageEditor({ image, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [filter, setFilter] = useState('none');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipped ? -1 : 1, 1);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${filter}`;

      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };
    img.src = image.url;
  }, [image, rotation, flipped, brightness, contrast, saturation, filter]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert to WebP
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Upload edited image
      const formData = new FormData();
      formData.append('image', blob, 'edited.webp');

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();
      onSave({ url: data.url, width: data.width, height: data.height });
    }, 'image/webp', 0.85);
  };

  const filters = [
    { name: 'none', label: 'None' },
    { name: 'grayscale(100%)', label: 'B&W' },
    { name: 'sepia(100%)', label: 'Sepia' },
    { name: 'invert(100%)', label: 'Invert' },
    { name: 'blur(2px)', label: 'Blur' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Image</h2>
          <button onClick={onClose} className="btn btn-outline">
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Canvas */}
          <div>
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Rotation */}
            <div>
              <label className="label">Rotation</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setRotation((rotation - 90) % 360)} className="btn btn-outline">
                  -90°
                </button>
                <button onClick={() => setRotation(0)} className="btn btn-outline">
                  Reset
                </button>
                <button onClick={() => setRotation((rotation + 90) % 360)} className="btn btn-outline">
                  +90°
                </button>
              </div>
            </div>

            {/* Flip */}
            <div>
              <label className="label">Flip</label>
              <button
                onClick={() => setFlipped(!flipped)}
                className="btn btn-outline mt-1"
              >
                {flipped ? 'Unflip' : 'Flip Horizontal'}
              </button>
            </div>

            {/* Brightness */}
            <div>
              <label className="label">Brightness: {brightness}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Contrast */}
            <div>
              <label className="label">Contrast: {contrast}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Saturation */}
            <div>
              <label className="label">Saturation: {saturation}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={saturation}
                onChange={(e) => setSaturation(parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Filters */}
            <div>
              <label className="label">Filter</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {filters.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setFilter(f.name)}
                    className={`btn text-xs ${filter === f.name ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <button onClick={handleSave} className="btn btn-primary w-full">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
