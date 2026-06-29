/**
 * Password Toggle Functionality
 * Supports both login and create account forms
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Login password toggle
    setupPasswordToggle('passwordToggle', 'loginPassword');
    
    // Create account password toggles
    setupPasswordToggle('createPasswordToggle', 'createPassword');
    setupPasswordToggle('createConfirmToggle', 'createConfirmPassword');
    
    // Password strength checker
    setupPasswordStrength();
    
    // Password match checker
    setupPasswordMatch();

    // Create account form submission
    setupCreateAccountForm();
  }

  function setupPasswordToggle(toggleId, inputId) {
    const toggleBtn = document.getElementById(toggleId);
    const passwordInput = document.getElementById(inputId);

    if (!toggleBtn || !passwordInput) return;

    const eyeIcon = toggleBtn.querySelector('.eye-icon');
    const eyeOffIcon = toggleBtn.querySelector('.eye-off-icon');

    let isPasswordVisible = false;

    function togglePasswordVisibility() {
      isPasswordVisible = !isPasswordVisible;

      passwordInput.type = isPasswordVisible ? 'text' : 'password';

      if (isPasswordVisible) {
        eyeIcon.style.display = 'none';
        eyeOffIcon.style.display = 'block';
        toggleBtn.setAttribute('aria-label', 'Hide password');
        toggleBtn.setAttribute('aria-pressed', 'true');
      } else {
        eyeIcon.style.display = 'block';
        eyeOffIcon.style.display = 'none';
        toggleBtn.setAttribute('aria-label', 'Show password');
        toggleBtn.setAttribute('aria-pressed', 'false');
      }

      passwordInput.focus();
    }

    toggleBtn.addEventListener('click', togglePasswordVisibility);

    toggleBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePasswordVisibility();
      }
    });
  }

  function setupPasswordStrength() {
    const passwordInput = document.getElementById('createPassword');
    if (!passwordInput) return;

    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthLabel = document.getElementById('strengthLabel');
    
    if (!strengthBars.length || !strengthLabel) return;

    passwordInput.addEventListener('input', function() {
      const password = this.value;
      const strength = calculatePasswordStrength(password);
      
      // Update bars
      strengthBars.forEach((bar, index) => {
        bar.className = 'strength-bar';
        if (index < strength.score) {
          bar.classList.add('active', strength.level);
        }
      });
      
      // Update label
      strengthLabel.textContent = strength.label;
      strengthLabel.className = strength.level;
    });
  }

  function calculatePasswordStrength(password) {
    let score = 0;
    
    if (!password) {
      return { score: 0, level: '', label: 'Enter a password' };
    }
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // Adjust scoring
    if (score <= 2) {
      return { score: 1, level: 'weak', label: 'Weak' };
    } else if (score <= 3) {
      return { score: 2, level: 'medium', label: 'Medium' };
    } else if (score <= 4) {
      return { score: 3, level: 'strong', label: 'Strong' };
    } else {
      return { score: 4, level: 'very-strong', label: 'Very Strong' };
    }
  }

  function setupPasswordMatch() {
    const passwordInput = document.getElementById('createPassword');
    const confirmInput = document.getElementById('createConfirmPassword');
    const matchText = document.querySelector('.match-text');
    
    if (!passwordInput || !confirmInput || !matchText) return;

    function checkMatch() {
      const password = passwordInput.value;
      const confirm = confirmInput.value;
      
      if (!confirm) {
        matchText.className = 'match-text';
        matchText.innerHTML = '<i class="fas fa-circle"></i> Confirm your password';
        return;
      }
      
      if (password === confirm) {
        matchText.className = 'match-text match';
        matchText.innerHTML = '<i class="fas fa-check-circle"></i> Passwords match';
      } else {
        matchText.className = 'match-text no-match';
        matchText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match';
      }
    }

    passwordInput.addEventListener('input', checkMatch);
    confirmInput.addEventListener('input', checkMatch);
  }

  function setupCreateAccountForm() {
    const form = document.getElementById('createAccountForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = document.getElementById('createFullName').value.trim();
      const email = document.getElementById('createEmail').value.trim();
      const password = document.getElementById('createPassword').value;
      const confirm = document.getElementById('createConfirmPassword').value;
      const role = document.getElementById('createRole').value;
      const municipality = document.getElementById('createMunicipality').value;
      
      // Validate
      if (!name || !email || !password || !confirm || !role || !municipality) {
        showError('Please fill in all fields.');
        return;
      }
      
      if (!email.includes('@') || !email.includes('.')) {
        showError('Please enter a valid email address.');
        return;
      }
      
      if (password.length < 8) {
        showError('Password must be at least 8 characters long.');
        return;
      }
      
      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }
      
      // Success - you can add your API call here
      alert('Account created successfully!');
      closeCreateAccountModal();
    });
  }

  function showError(message) {
    const errorDiv = document.getElementById('createAccountError');
    const errorMessage = document.getElementById('createAccountErrorMessage');
    if (errorDiv && errorMessage) {
      errorMessage.textContent = message;
      errorDiv.style.display = 'flex';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }
})();

// Close modal function (if not already defined)
function closeCreateAccountModal() {
  const modal = document.getElementById('createAccountModal');
  if (modal) {
    modal.classList.remove('active');
  }
  // Reset form
  const form = document.getElementById('createAccountForm');
  if (form) {
    form.reset();
    // Clear password strength
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthLabel = document.getElementById('strengthLabel');
    if (strengthBars.length && strengthLabel) {
      strengthBars.forEach(bar => bar.className = 'strength-bar');
      strengthLabel.textContent = 'Enter a password';
      strengthLabel.className = '';
    }
    // Clear match indicator
    const matchText = document.querySelector('.match-text');
    if (matchText) {
      matchText.className = 'match-text';
      matchText.innerHTML = '<i class="fas fa-circle"></i> Passwords do not match';
    }
  }
}

// Show modal function (if not already defined)
function showCreateAccountModal() {
  const modal = document.getElementById('createAccountModal');
  if (modal) {
    modal.classList.add('active');
  }
}

// Expose functions globally
window.closeCreateAccountModal = closeCreateAccountModal;
window.showCreateAccountModal = showCreateAccountModal;