# Photo Frame Generator - Full Stack Project

## Backend (Flask)
- Python Flask API for image processing
- Endpoint: `/generate` (POST)
- Accepts: 1 template image, 4 user photos
- Returns: Composited image with all slots filled

### Setup
```
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Frontend (React)
- Modern UI with Tailwind CSS, Framer Motion and Lucide React icons
- React app for uploading template and 4 photos
- Sends files to backend and displays result
- Real-time preview updates
- QR code sharing functionality
- Mobile responsive design

### Setup
```
cd frontend
npm install
npm start
```

## Modern UI Features
- 🎨 Sleek, minimal design with soft gradients and rounded corners
- 🌓 Light/dark mode friendly design
- 📱 Fully responsive layout
- ✨ Smooth animations and transitions
- 📊 Real-time preview updates
- 📷 Clean upload interface
- 🔄 Progress indicators
- 📱 QR code sharing

---

- Make sure backend is running on port 5000 (default Flask)
- Frontend expects backend at `http://localhost:5001`
- Adjust CORS or proxy settings if needed
