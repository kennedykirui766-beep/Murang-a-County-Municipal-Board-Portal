/**
 * QR Code Attendance System
 * Handles QR generation, scanning, and geolocation verification
 */

// QRCode library from CDN - add to your HTML files
// <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>

// QR Attendance Manager
const QRManager = {
  // Generate QR code for a meeting
  generateQR(meetingId, meetingData) {
    const payload = {
      meetingId: meetingId,
      meetingTitle: meetingData.title,
      timestamp: new Date().toISOString(),
      municipality: meetingData.municipality,
      // Location will be set when generating
    };
    return btoa(JSON.stringify(payload)); // Base64 encode
  },

  // Verify QR code data
  verifyQR(encodedData) {
    try {
      const decoded = JSON.parse(atob(encodedData));
      return decoded;
    } catch (e) {
      return null;
    }
  },

  // Get current location
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  },

  toRad(deg) {
    return deg * (Math.PI / 180);
  },

  // Validate attendance with location
  async validateAttendance(meetingId, qrData, userLocation) {
    // Check if QR data is valid
    if (!qrData || qrData.meetingId !== meetingId) {
      return { valid: false, reason: 'Invalid QR code' };
    }

    // Check if QR code has expired (30 minute window)
    const qrTime = new Date(qrData.timestamp);
    const now = new Date();
    const diffMinutes = (now - qrTime) / (1000 * 60);
    if (diffMinutes > 30) {
      return { valid: false, reason: 'QR code has expired' };
    }

    // Check if user location is within range (100 meters)
    if (userLocation) {
      // The meeting location should be stored when QR is generated
      if (qrData.meetingLat && qrData.meetingLng) {
        const distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          qrData.meetingLat,
          qrData.meetingLng
        );
        // Convert km to meters
        const distanceMeters = distance * 1000;
        if (distanceMeters > 100) {
          return {
            valid: false,
            reason: `You are ${Math.round(distanceMeters)} meters away. Please be within 100 meters of the meeting venue.`
          };
        }
      }
    }

    return { valid: true };
  },

  // Save attendance record
  async saveAttendance(meetingId, userId, qrData, location) {
    const attendanceRecord = {
      meetingId: meetingId,
      userId: userId,
      userName: currentUser ? currentUser.name : 'Unknown',
      userEmail: currentUser ? currentUser.email : 'Unknown',
      checkInTime: new Date().toISOString(),
      qrTimestamp: qrData.timestamp,
      location: location || null,
      verified: true
    };

    // Store in localStorage
    const attendance = JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
    // Check if already checked in
    const existing = attendance.find(
      a => a.meetingId === meetingId && a.userId === userId
    );
    if (existing) {
      return { success: false, message: 'You have already checked in to this meeting.' };
    }
    attendance.push(attendanceRecord);
    localStorage.setItem('mbp_attendance', JSON.stringify(attendance));
    return { success: true, message: 'Attendance confirmed!', record: attendanceRecord };
  },

  // Get attendance for a meeting
  getAttendance(meetingId) {
    const attendance = JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
    return attendance.filter(a => a.meetingId === meetingId);
  },

  // Get all attendance
  getAllAttendance() {
    return JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
  }
};