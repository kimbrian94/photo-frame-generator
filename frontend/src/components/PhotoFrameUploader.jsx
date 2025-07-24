import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, X, Check, Share2, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ImageModal from './ImageModal';

const PhotoFrameUploader = () => {
  const [templates, setTemplates] = useState([]); // {filename, path}
  const [photos, setPhotos] = useState([]); // {file, url}
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]); // [{file, url}]
  const [previewUrl, setPreviewUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
  const [photoRatios, setPhotoRatios] = useState({});

  // Fetch available templates from backend
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('http://localhost:5001/get_templates');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.templates) {
            setTemplates(data.templates.map(template => ({
              ...template,
              url: `http://localhost:5001${template.path}`
            })));
          }
        } else {
          console.error('Failed to fetch templates');
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };
    
    fetchTemplates();
  }, []);

  // Update preview on template or photo selection change
  useEffect(() => {
    const updatePreview = async () => {
      if (!selectedTemplate) {
        setPreviewUrl(null);
        return;
      }
      
      setLoading(true);
      const formData = new FormData();
      
      // For templates, we need to fetch the image first as it's a URL
      try {
        const templateResponse = await fetch(selectedTemplate.url);
        const templateBlob = await templateResponse.blob();
        const templateFile = new File([templateBlob], selectedTemplate.filename, { type: templateBlob.type });
        formData.append('template', templateFile);
      } catch (error) {
        console.error('Error fetching template file:', error);
        setLoading(false);
        return;
      }
      
      // Always send 4 slots, fill with null if not selected
      for (let i = 0; i < 4; i++) {
        if (selectedPhotos[i]) formData.append(`photo${i+1}`, selectedPhotos[i].file);
      }
      
      try {
        const res = await fetch('http://localhost:5001/generate', { 
          method: 'POST', 
          body: formData 
        });
        
        if (res.ok) {
          const blob = await res.blob();
          setPreviewUrl(URL.createObjectURL(blob));
        } else {
          setPreviewUrl(null);
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        setPreviewUrl(null);
      } finally {
        setLoading(false);
      }
    };
    
    updatePreview();
  }, [selectedTemplate, selectedPhotos]);

  // No template drop handler needed as templates are static
  
  // Photo drop handler
  const handlePhotoDrop = acceptedFiles => {
    const newPhotos = acceptedFiles.map(file => ({ file, url: URL.createObjectURL(file) }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  // Select template (only one)
  const handleTemplateSelect = fileObj => {
    setSelectedTemplate(fileObj);
  };

  // Select photo (up to 4, numbered)
  const handlePhotoSelect = fileObj => {
    setSelectedPhotos(prev => {
      if (prev.some(p => p.url === fileObj.url)) {
        // Deselect
        return prev.filter(p => p.url !== fileObj.url);
      } else if (prev.length < 4) {
        // Select
        return [...prev, fileObj];
      } else {
        return prev;
      }
    });
  };

  // Clear all
  const handleClear = () => {
    // setTemplates([]);
    setPhotos([]);
    setSelectedTemplate(null);
    setSelectedPhotos([]);
    setResultUrl(null);
    setPreviewUrl(null);
    setModalOpen(false);
    setLoading(false);
  };

  // Generate
  const handleGenerate = async () => {
    if (!selectedTemplate || selectedPhotos.length !== 4) return;
    setLoading(true);
    const formData = new FormData();
    
    // For templates, we need to fetch the image first as it's a URL
    try {
      const templateResponse = await fetch(selectedTemplate.url);
      const templateBlob = await templateResponse.blob();
      const templateFile = new File([templateBlob], selectedTemplate.filename, { type: templateBlob.type });
      formData.append('template', templateFile);
    } catch (error) {
      console.error('Error fetching template file:', error);
      setLoading(false);
      return;
    }
    
    selectedPhotos.forEach((photoObj, idx) => {
      formData.append(`photo${idx+1}`, photoObj.file);
    });
    try {
      const res = await fetch('http://localhost:5001/generate', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const blob = await res.blob();
        setResultUrl(URL.createObjectURL(blob));
        setModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // No Template Dropzone needed as templates are static

  // Photo Dropzone
  const { getRootProps: getPhotoRootProps, getInputProps: getPhotoInputProps } = useDropzone({
    onDrop: handlePhotoDrop,
    accept: { 'image/*': [] },
    multiple: true
  });

  // Calculate aspect ratios for all photos
  useEffect(() => {
    const newRatios = {};
    photos.forEach(photo => {
      const img = new window.Image();
      img.src = photo.url;
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          newRatios[photo.url] = img.naturalWidth / img.naturalHeight;
          setPhotoRatios(r => ({ ...r, [photo.url]: newRatios[photo.url] }));
        }
      };
    });
    
    // Clean up photoRatios for deleted photos
    setPhotoRatios(currentRatios => {
      const updatedRatios = { ...currentRatios };
      Object.keys(updatedRatios).forEach(url => {
        if (!photos.some(photo => photo.url === url)) {
          delete updatedRatios[url];
        }
      });
      return updatedRatios;
    });
  }, [photos]);

  return (
    <div className="container max-w-7xl mx-auto p-4 h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-4 tracking-tighter inline-block px-2" style={{ fontFamily: "'Poppins', system-ui", letterSpacing: '0.01em', width: 'auto', overflow: 'visible', paddingBottom: '0.25rem', lineHeight: '1.2' }}>
          youngnakism
        </h1>
      </motion.div>

      {/* Centered sections and buttons layout */}
      <div className="flex flex-row items-center justify-center gap-10 min-h-[75vh]">
        {/* Centered grid for Template, Photos, Preview */}
        <div className="flex flex-row items-stretch justify-center gap-8">
          {/* Templates section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-[260px] flex flex-col"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 h-full">
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "'Poppins', system-ui" }}>Templates</h2>
              {/* Template dropzone, gallery, selected preview */}
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4" style={{ fontFamily: "'Poppins', system-ui" }}>
                Select a template to use
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {templates.map((template, idx) => {
                  const isSelected = selectedTemplate && selectedTemplate.url === template.url;
                  return (
                    <motion.div 
                      key={template.url + idx}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 ${isSelected ? 'border-violet-500' : 'border-transparent'}`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <img 
                        src={template.url} 
                        alt={template.filename}
                        className="w-full h-32 object-cover"
                      />
                      {/* No remove button for static templates */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 bg-violet-500 text-white w-6 h-6 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {selectedTemplate && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" style={{ fontFamily: "'Poppins', system-ui" }}>
                    Selected Template
                  </h3>
                  <div className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg">
                    <img 
                      src={selectedTemplate.url} 
                      alt="Selected Template" 
                      className="w-full max-h-80 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Photos section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full md:w-[420px] flex flex-col"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 h-full">
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "'Poppins', system-ui" }}>Photos</h2>
              {/* ...existing code... */}
              <div {...getPhotoRootProps({ className: "flex flex-col items-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 mb-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer" })}>
                <input {...getPhotoInputProps()} />
                <Upload className="w-8 h-8 text-slate-500 dark:text-slate-400 mb-2" />
                <p className="text-sm text-center text-slate-500 dark:text-slate-400" style={{ fontFamily: "'Poppins', system-ui" }}>
                  Drag & drop or click to select photos
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" style={{ fontFamily: "'Poppins', system-ui" }}>
                  Select up to 4 photos
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-8 mt-4">
                {photos.map((photo, idx) => {
                  const isSelected = selectedPhotos.some(sel => sel.url === photo.url);
                  const selectionIndex = selectedPhotos.findIndex(sel => sel.url === photo.url);
                  const imgRatio = photoRatios[photo.url] || 1.5; // default landscape
                  // Card sizing: always fit grid cell, max height capped
                  const maxHeight = 320;
                  return (
                    <motion.div 
                      key={photo.url + idx}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      animate={isSelected ? { scale: 1.12 } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className={`relative cursor-pointer rounded-xl overflow-hidden border-2 ${isSelected ? 'border-violet-500 shadow-xl z-10' : 'border-transparent'} bg-white dark:bg-slate-800 flex items-center justify-center`}
                      style={{ width: '100%', maxWidth: '100%', aspectRatio: imgRatio, maxHeight }}
                      onClick={() => handlePhotoSelect(photo)}
                    >
                      <img 
                        src={photo.url} 
                        alt={`Photo ${idx}`}
                        className={`w-full h-full object-cover ${isSelected ? 'ring-2 ring-violet-400' : ''}`}
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                      />
                      <div 
                        className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white w-6 h-6 rounded flex items-center justify-center opacity-70 hover:opacity-100 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotos(prev => prev.filter(p => p.url !== photo.url));
                          setSelectedPhotos(prev => prev.filter(p => p.url !== photo.url));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 left-2 bg-violet-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                          {selectionIndex !== -1 ? selectionIndex + 1 : '✓'}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Preview section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full md:w-[450px] flex flex-col"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg h-full flex flex-col">
              <h2 className="text-lg font-bold mb-4 px-4 pt-4" style={{ fontFamily: "'Poppins', system-ui" }}>Preview</h2>
              <div className="flex-grow flex flex-col items-center justify-start relative p-0 m-0" style={{height: 'calc(100% - 3rem)'}}>
                {loading ? (
                  <div className="absolute inset-0 bg-slate-700/30 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-2" />
                      <p className="text-sm text-white">Processing...</p>
                    </div>
                  </div>
                ) : previewUrl ? (
                  <div className="w-full flex flex-col items-center pt-4">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="object-contain"
                      style={{ maxWidth: '80%', maxHeight: '80%' }}
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 w-full h-full flex flex-col items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: "'Poppins', system-ui" }}>
                      {selectedTemplate ? "Add photos to see preview" : "Select a template to start"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        {/* Buttons to the right of centered sections */}
        <div className="flex flex-col gap-3 items-center justify-center ml-8">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleGenerate}
            disabled={loading || !selectedTemplate || selectedPhotos.length !== 4}
            className={`px-6 py-2.5 rounded-full flex items-center ${selectedTemplate && selectedPhotos.length === 4 ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            style={{ fontFamily: "'Poppins', system-ui" }}
          >
            <Share2 className="w-5 h-5 mr-2" />
            Generate & Share
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClear}
            disabled={loading}
            className="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-full"
            style={{ fontFamily: "'Poppins', system-ui" }}
          >
            Clear All
          </motion.button>
        </div>
      </div>

      {modalOpen && (
        <ImageModal 
          open={modalOpen} 
          onClose={() => setModalOpen(false)} 
          imageUrl={resultUrl}
        />
      )}
    </div>
  );
};

export default PhotoFrameUploader;
