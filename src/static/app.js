document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Authentication elements
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const authStatus = document.getElementById("auth-status");
  const teacherName = document.getElementById("teacher-name");
  const teacherOnlyNotice = document.getElementById("teacher-only-notice");
  const signupSubmit = document.getElementById("signup-submit");
  const closeModal = document.querySelector(".close");

  let isTeacherAuthenticated = false;
  let authToken = localStorage.getItem("authToken");

  // Authentication functions
  async function checkAuthentication() {
    if (!authToken) {
      setUnauthenticatedState();
      return;
    }

    try {
      const response = await fetch("/auth/verify", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAuthenticatedState(data.teacher_name);
      } else {
        localStorage.removeItem("authToken");
        authToken = null;
        setUnauthenticatedState();
      }
    } catch (error) {
      console.error("Error verifying authentication:", error);
      setUnauthenticatedState();
    }
  }

  function setAuthenticatedState(name) {
    isTeacherAuthenticated = true;
    loginBtn.classList.add("hidden");
    authStatus.classList.remove("hidden");
    teacherName.textContent = `Welcome, ${name}`;
    teacherOnlyNotice.classList.add("hidden");
    signupForm.classList.remove("form-disabled");
    signupSubmit.disabled = false;
  }

  function setUnauthenticatedState() {
    isTeacherAuthenticated = false;
    loginBtn.classList.remove("hidden");
    authStatus.classList.add("hidden");
    teacherOnlyNotice.classList.remove("hidden");
    signupForm.classList.add("form-disabled");
    signupSubmit.disabled = true;
  }

  // Modal event listeners
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
      });

      const data = await response.json();
      const loginMessage = document.getElementById("login-message");

      if (response.ok) {
        authToken = data.access_token;
        localStorage.setItem("authToken", authToken);
        setAuthenticatedState(data.teacher_name);
        loginModal.classList.add("hidden");
        loginForm.reset();
        loginMessage.classList.add("hidden");
        showMessage("Successfully logged in!", "success");
      } else {
        loginMessage.textContent = data.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      const loginMessage = document.getElementById("login-message");
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Logout functionality
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    authToken = null;
    setUnauthenticatedState();
    showMessage("Successfully logged out", "info");
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    // Only show delete button if teacher is authenticated
                    const deleteBtn = isTeacherAuthenticated 
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : '';
                    return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if teacher is authenticated)
      if (isTeacherAuthenticated) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality - Teachers only
  async function handleUnregister(event) {
    if (!isTeacherAuthenticated) {
      showMessage("Only teachers can unregister students", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission - Teachers only
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherAuthenticated) {
      showMessage("Only teachers can register students", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthentication();
  fetchActivities();
});
