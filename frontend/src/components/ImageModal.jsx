import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Download, Loader2, Check } from 'lucide-react';
import qrcode from 'qrcode';

const ImageModal = ({ open, onClose, imageUrl }) => {
  const [qrUrl, setQrUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localPath, setLocalPath] = useState("");
  const [tagName, setTagName] = useState("");
  const [copyCount, setCopyCount] = useState(2); // Default to 2 copies side by side
  const qrCanvasRef = useRef(null);
  
  useEffect(() => {
    let isMounted = true;
    
    if (!imageUrl) {
      setQrUrl("");
      setUploadError("");
      return;
    }
    
    // Upload to backend proxy when modal opens and imageUrl changes
    const upload = async () => {
      setUploading(true);
      setUploadError("");
      setQrUrl("");
      
      try {
        // Convert blob URL to File
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "photo-frame.png", { type: blob.type });
        
        const formData = new FormData();
        formData.append("file", file);
        
        // Upload to backend, which proxies to GoFile.io
        const res = await fetch("http://localhost:5001/upload_temp", {
          method: "POST",
          body: formData
        });
        
        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        if (data.success && data.link) {
          setQrUrl(data.link);
        } else {
          throw new Error(data.message || "Upload failed");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setUploadError("Failed to upload image for sharing. Please try again.");
        }
      } finally {
        if (isMounted) {
          setUploading(false);
        }
      }
    };
    
    upload();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // Generate QR code when qrUrl changes and modal is open
  useEffect(() => {
    if (qrUrl && qrCanvasRef.current && open) {
      qrcode.toCanvas(
        qrCanvasRef.current,
        qrUrl,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#6d28d9',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [qrUrl, open]);
  
  // Copy link to clipboard
  const copyToClipboard = () => {
    if (qrUrl) {
      navigator.clipboard.writeText(qrUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy: ', err));
    }
  };
  
  // Download the generated image
  const downloadImage = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'photo-frame.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  // Save the generated image locally on the server
  const saveLocally = async () => {
    if (!imageUrl) return;
    
    try {
      setSaving(true);
      
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "frame.png", { type: blob.type });
      
      const formData = new FormData();
      formData.append("file", file);
      
      // Add tag name if provided
      if (tagName.trim()) {
        formData.append("tagName", tagName.trim());
      }
      
      // Add number of copies to be placed side by side
      formData.append("copyCount", copyCount.toString());
      
      // Send to our save_locally endpoint
      const res = await fetch("http://localhost:5001/save_locally", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("Save failed");
      
      const data = await res.json();
      
      if (data.success) {
        setSaved(true);
        setLocalPath(data.filepath);
        setTimeout(() => setSaved(false), 5000); // Show "Saved!" for 5 seconds
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err) {
      console.error("Error saving locally:", err);
      alert("Failed to save image locally.");
    } finally {
      setSaving(false);
    }
  };
  
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden"
          >
            {/* Close button */}
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={onClose}
                className="bg-white/90 dark:bg-slate-800/90 rounded-full p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Main content: photo left, QR/share right */}
            <div className="flex flex-row h-full w-full">
              {/* Generated photo left */}
              <div className="flex-1 flex items-center justify-center p-8">
                {imageUrl ? (
                  <div className="rounded-lg overflow-hidden flex justify-center items-center w-full h-full bg-slate-100 dark:bg-slate-700">
                    <img 
                      src={imageUrl} 
                      alt="Generated Frame" 
                      className="max-w-full max-h-[80vh] object-contain shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-8 text-center w-full h-full flex items-center justify-center">
                    <p>No image available</p>
                  </div>
                )}
              </div>
              {/* Right panel for actions */}
              <div className="w-full max-w-sm flex flex-col justify-center items-center p-6 border-l border-slate-200 dark:border-slate-700">
                <h3 className="text-2xl font-extrabold mb-4 text-center bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent" style={{ fontFamily: "'Poppins', system-ui", letterSpacing: '-0.05em' }}>youngnakism</h3>
                <div className="flex flex-col items-center gap-6 w-full">
                  {/* QR code section */}
                  <div className="w-full border-b border-slate-200 dark:border-slate-700 pb-6">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium self-start mb-2" style={{ fontFamily: "'Poppins', system-ui" }}>Share online:</p>
                    <div className="flex-shrink-0 w-44 h-44 flex items-center justify-center mx-auto">
                      {uploading ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        </div>
                      ) : uploadError ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg p-4 text-center">
                          <p className="text-sm text-red-500" style={{ fontFamily: "'Poppins', system-ui" }}>{uploadError}</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-lg shadow-sm flex items-center justify-center">
                          <canvas ref={qrCanvasRef} width="180" height="180" className="w-full h-full max-w-[180px] max-h-[180px]" />
                        </div>
                      )}
                    </div>
                    {qrUrl && (
                      <div className="w-full mt-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium" style={{ fontFamily: "'Poppins', system-ui" }}>Share link:</p>
                        <div className="flex">
                          <div className="bg-slate-100 dark:bg-slate-700 p-2 px-3 rounded-l-md flex-grow text-sm truncate">
                            {qrUrl}
                          </div>
                          <button 
                            onClick={copyToClipboard}
                            className="bg-violet-500 hover:bg-violet-600 text-white p-2 rounded-r-md flex items-center"
                          >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        {copied && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                            Copied to clipboard!
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Save locally section with tag name - Always visible */}
                  <div className="w-full">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-2" style={{ fontFamily: "'Poppins', system-ui" }}>Save locally:</p>
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                        Optional tag (saves in a folder with this name):
                      </p>
                      <input
                        type="text"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                        placeholder="Enter tag for folder organization"
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                        style={{ fontFamily: "'Poppins', system-ui" }}
                      />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                        Files will be saved in /resources/generated_photos/[tag_name]
                      </p>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                        Number of copies side by side:
                      </p>
                      <select
                        value={copyCount}
                        onChange={(e) => setCopyCount(parseInt(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                        style={{ fontFamily: "'Poppins', system-ui" }}
                      >
                        <option value={1}>1 copy</option>
                        <option value={2}>2 copies</option>
                        <option value={3}>3 copies</option>
                        <option value={4}>4 copies</option>
                        <option value={5}>5 copies</option>
                      </select>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                        {copyCount > 1 ? `${copyCount} copies will be attached side by side` : "Single copy"}
                      </p>
                    </div>
                    
                    <button
                      onClick={saveLocally}
                      disabled={saving}
                      className={`w-full py-2 rounded-md flex items-center justify-center ${
                        saved ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                      } text-white transition-all`}
                      style={{ fontFamily: "'Poppins', system-ui" }}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : saved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        "Save Image Locally"
                      )}
                    </button>
                    {saved && localPath && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium" style={{ fontFamily: "'Poppins', system-ui" }}>
                          Successfully saved!
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500 mt-1 break-all font-mono" style={{ fontFamily: "'Poppins', system-ui" }}>
                          Path: {localPath}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Only close button now */}
                  <div className="flex flex-row gap-2 w-full justify-center mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={onClose}
                      className="flex-1 items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 px-4 rounded-md font-semibold flex"
                      style={{ fontFamily: "'Poppins', system-ui" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ImageModal;
