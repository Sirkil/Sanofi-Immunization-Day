// Get DOM Elements
const dropZone = document.getElementById('dropZone');
const imageUpload = document.getElementById('imageUpload');
const browseLink = document.getElementById('browseLink');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const createBtn = document.getElementById('createBtn');
const dropZoneThumbnails = document.getElementById('dropZoneThumbnails');

const loadingIndicator = document.getElementById('loadingIndicator');
const previewSection = document.getElementById('previewSection');
const canvas = document.getElementById('resultCanvas');
const ctx = canvas.getContext('2d');
const thumbnailGallery = document.getElementById('thumbnailGallery');

const downloadBtn = document.getElementById('downloadBtn');
const downloadTitle = document.getElementById('downloadTitle');
const downloadSub = document.getElementById('downloadSub');

// Global state
let selectedFiles = [];
let downloadAction = null;

// --- Load Static Layer ---
const overlayImage = new Image();
// Ensure this filename matches the frame image you want to use
overlayImage.src = 'linkedin Frame.png'; 

// --- Upload & Drag/Drop Logic ---
const triggerUpload = () => imageUpload.click();
browseLink.addEventListener('click', triggerUpload);
uploadBtn.addEventListener('click', triggerUpload);

imageUpload.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

// Process selected files
function handleFiles(files) {
    if (files.length === 0) return;
    
    selectedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (selectedFiles.length === 0) {
        uploadStatus.textContent = "STATUS: Invalid file type";
        dropZoneThumbnails.innerHTML = ''; 
        return;
    }

    uploadStatus.textContent = `STATUS: ${selectedFiles.length} image(s) uploaded`;
    createBtn.disabled = false; 
    
    previewSection.style.display = 'none';
    thumbnailGallery.innerHTML = ''; 
    dropZoneThumbnails.innerHTML = ''; 
    
    selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'drop-zone-thumb';
            img.title = file.name; 
            dropZoneThumbnails.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// --- Image Creation Logic ---
createBtn.addEventListener('click', async function() {
    if (selectedFiles.length === 0) return;

    createBtn.disabled = true;
    uploadBtn.disabled = true;
    loadingIndicator.style.display = 'block';
    previewSection.style.display = 'none';

    try {
        if (selectedFiles.length === 1) {
            const result = await processSingleImage(selectedFiles[0]);
            
            downloadTitle.textContent = "DOWNLOAD IMAGE";
            downloadSub.textContent = `(${result.filename})`;
            
            downloadAction = () => {
                const a = document.createElement('a');
                a.href = result.dataUrl;
                a.download = result.filename;
                a.click();
            };
            
        } else {
            const zip = new JSZip();
            
            for (let i = 0; i < selectedFiles.length; i++) {
                const result = await processSingleImage(selectedFiles[i]);
                zip.file(result.filename, result.blob); 
                createThumbnail(selectedFiles[i], i === 0);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(zipBlob);

            downloadTitle.textContent = "DOWNLOAD ZIP ARCHIVE";
            downloadSub.textContent = "(generated Images.zip)";
            
            downloadAction = () => {
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = 'generated Images.zip';
                a.click();
            };
        }

        showMainPreview(selectedFiles[0]);

        loadingIndicator.style.display = 'none';
        previewSection.style.display = 'block';
        
        createBtn.disabled = false;
        uploadBtn.disabled = false;

    } catch (error) {
        console.error("Error:", error);
        loadingIndicator.querySelector('p').textContent = "An error occurred. Please refresh and try again.";
        createBtn.disabled = false;
        uploadBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (downloadAction) downloadAction();
});

// --- Helper Functions ---

// Processes the image in the background, returns Blob and DataURL
function processSingleImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const userImage = new Image();
            userImage.onload = () => {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = 1080; 
                offCanvas.height = 1080;
                const offCtx = offCanvas.getContext('2d');

                // Clear transparent canvas
                offCtx.clearRect(0, 0, 1080, 1080);

                // Z-Index 1: User Image (Circularly Clipped)
                offCtx.save(); 
                offCtx.beginPath();
                // Create a circle at x=540, y=540 with radius=540
                offCtx.arc(540, 540, 540, 0, Math.PI * 2); 
                offCtx.clip(); 

                // Scale image to fill the 1080x1080 canvas completely (object-fit: cover)
                const scale = Math.max(1080 / userImage.width, 1080 / userImage.height);
                const drawWidth = userImage.width * scale;
                const drawHeight = userImage.height * scale;
                
                // Center the image
                const x = (1080 - drawWidth) / 2;
                const y = (1080 - drawHeight) / 2;

                offCtx.drawImage(userImage, x, y, drawWidth, drawHeight);
                offCtx.restore(); 

                // Z-Index 2: Foreground Overlay Image
                offCtx.drawImage(overlayImage, 0, 0, 1080, 1080);

                const originalName = file.name;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                const newFileName = `${nameWithoutExt} Cropped.png`; 

                offCanvas.toBlob((blob) => {
                    resolve({
                        blob: blob,
                        dataUrl: offCanvas.toDataURL('image/png', 0.9), 
                        filename: newFileName
                    });
                }, 'image/png');
            };
            userImage.onerror = reject;
            userImage.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Renders an image to the visible preview canvas
function showMainPreview(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Z-Index 1: User Image (Circularly Clipped)
            ctx.save(); 
            ctx.beginPath();
            ctx.arc(540, 540, 540, 0, Math.PI * 2); 
            ctx.clip();

            // Scale image to fill the 1080x1080 canvas completely (object-fit: cover)
            const scale = Math.max(1080 / img.width, 1080 / img.height);
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;
            
            // Center the image
            const x = (1080 - drawWidth) / 2;
            const y = (1080 - drawHeight) / 2;
            
            ctx.drawImage(img, x, y, drawWidth, drawHeight);
            ctx.restore(); 

            // Z-Index 2: Foreground Overlay Image
            ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Creates small clickable thumbnails for the gallery
function createThumbnail(file, isActive) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.className = 'thumb' + (isActive ? ' active' : '');
        
        img.onclick = () => {
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            img.classList.add('active');
            showMainPreview(file);
        };
        
        thumbnailGallery.appendChild(img);
    };
    reader.readAsDataURL(file);
}