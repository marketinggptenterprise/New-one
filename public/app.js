const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const storage = {
  get profile() {
    return JSON.parse(localStorage.getItem("pcs.profile") || "{}");
  },
  set profile(value) {
    localStorage.setItem("pcs.profile", JSON.stringify(value));
  },
  get gallery() {
    return JSON.parse(localStorage.getItem("pcs.gallery") || "[]");
  },
  set gallery(value) {
    localStorage.setItem("pcs.gallery", JSON.stringify(value));
  }
};

let currentPoster = "";
let googleLocations = [];

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillForm(form, data) {
  Object.entries(data).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input && input.type !== "file") input.value = value || "";
  });
}

function fileToDataUrl(file) {
  if (!file || !file.size) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function switchView(viewId) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  if (viewId === "gallery") renderGallery();
}

function renderGallery() {
  const gallery = storage.gallery;
  const grid = $("#galleryGrid");
  if (!gallery.length) {
    grid.innerHTML = '<p class="status">No saved posters yet.</p>';
    return;
  }
  grid.innerHTML = gallery.map((item, index) => `
    <article>
      <img src="${item.image}" alt="Saved poster ${index + 1}">
      <div>
        <strong>${item.businessName || "Poster"}</strong>
        <small>${item.topic || "Campaign poster"}</small>
      </div>
    </article>
  `).join("");
}

function profileLabel(location) {
  return `${location.title || location.name}${location.address ? ` - ${location.address}` : ""}`;
}

function updateDesignerProfiles() {
  const select = $("#designerProfileSelect");
  const currentValue = select.value;
  select.innerHTML = '<option value="">Manual business details</option>' + googleLocations.map((location, index) => (
    `<option value="${index}">${profileLabel(location)}</option>`
  )).join("");
  select.value = currentValue;
}

function applyGoogleProfile(location) {
  const posterForm = $("#posterForm");
  const postForm = $("#postForm");
  posterForm.elements.businessName.value = location.title || "";
  posterForm.elements.location.value = location.address || "";
  if (!posterForm.elements.industry.value) posterForm.elements.industry.value = "Local business";
  postForm.elements.locationName.value = location.name;
  postForm.elements.accountName.value = location.accountName;
  storage.profile = formData(posterForm);
}

function setPoster(image) {
  const absoluteImage = image.startsWith("/") ? `${location.origin}${image}` : image;
  currentPoster = absoluteImage;
  $("#posterImage").src = absoluteImage;
  $("#posterImage").onerror = () => {
    $("#posterStatus").style.display = "block";
    $("#posterStatus").textContent = "The image provider returned a link that could not be displayed. Try Generate Poster again.";
    $("#posterImage").style.display = "none";
  };
  $("#posterImage").style.display = "block";
  $("#posterStatus").style.display = "none";
  $("#downloadPoster").href = absoluteImage;
  $("#downloadPoster").classList.remove("hidden");
  $("#savePoster").classList.remove("hidden");
  if (absoluteImage.startsWith("http")) {
    $("#postForm").elements.imageUrl.value = absoluteImage;
    $("#postStatus").textContent = "Generated poster URL added. You can post it from the Google tab.";
  } else {
    $("#postStatus").textContent = "Generated poster is downloadable. To post it to Google, upload it somewhere public and paste the image URL.";
  }
}

$$(".nav").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

fillForm($("#posterForm"), storage.profile);
fillForm($("#copyForm"), storage.profile);

$("#saveProfile").addEventListener("click", () => {
  storage.profile = formData($("#posterForm"));
  fillForm($("#copyForm"), storage.profile);
  alert("Profile saved in this browser.");
});

$("#posterForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formData(form);
  payload.logo = await fileToDataUrl(form.elements.logo.files[0]);
  payload.referenceImage = await fileToDataUrl(form.elements.referenceImage.files[0]);

  $("#posterStatus").style.display = "block";
  $("#posterStatus").textContent = "Generating poster...";
  $("#posterImage").style.display = "none";

  try {
    const result = await postJson("/api/generate-poster", payload);
    setPoster(result.image);
  } catch (error) {
    $("#posterStatus").textContent = error.message;
  }
});

$("#savePoster").addEventListener("click", () => {
  if (!currentPoster) return;
  const details = formData($("#posterForm"));
  storage.gallery = [{ ...details, image: currentPoster, savedAt: Date.now() }, ...storage.gallery].slice(0, 30);
  alert("Poster saved to gallery.");
});

$("#copyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#copyOutput").textContent = "Generating copy...";
  try {
    const result = await postJson("/api/generate-copy", formData(event.currentTarget));
    $("#copyOutput").textContent = result.text;
  } catch (error) {
    $("#copyOutput").textContent = error.message;
  }
});

$("#loadLocations").addEventListener("click", async () => {
  const list = $("#locationsList");
  list.textContent = "Loading profiles...";
  try {
    const result = await getJson("/api/google-locations");
    googleLocations = result.locations || [];
    updateDesignerProfiles();
    if (!result.locations.length) {
      list.textContent = "No Google Business Profile locations were found for this account.";
      return;
    }
    list.innerHTML = result.locations.map((location, index) => `
      <button class="location" type="button" data-index="${index}" data-name="${location.name}" data-account="${location.accountName}">
        <strong>${location.title || location.name}</strong>
        <small>${location.address || location.name}</small>
      </button>
    `).join("");
  } catch (error) {
    list.textContent = error.message;
  }
});

$("#locationsList").addEventListener("click", (event) => {
  const button = event.target.closest(".location");
  if (!button) return;
  $$(".location").forEach((item) => item.classList.toggle("active", item === button));
  const location = googleLocations[Number(button.dataset.index)];
  if (!location) return;
  applyGoogleProfile(location);
  $("#designerProfileSelect").value = button.dataset.index;
});

$("#designerProfileSelect").addEventListener("change", (event) => {
  const index = event.target.value;
  if (index === "") return;
  const location = googleLocations[Number(index)];
  if (location) applyGoogleProfile(location);
});

$("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#postStatus").textContent = "Posting...";
  try {
    const result = await postJson("/api/google-post", formData(event.currentTarget));
    $("#postStatus").textContent = `Posted successfully: ${result.name}`;
  } catch (error) {
    $("#postStatus").textContent = error.message;
  }
});

$("#clearGallery").addEventListener("click", () => {
  if (!confirm("Clear all saved posters from this browser?")) return;
  storage.gallery = [];
  renderGallery();
});

renderGallery();
