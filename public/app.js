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
let multiSelectedLocations = [];

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

function renderMultiLocations() {
  const list = $("#multiLocationsList");
  if (!googleLocations.length) {
    list.textContent = "No Google Business Profile locations loaded yet.";
    return;
  }
  list.innerHTML = googleLocations.map((location, index) => {
    const selected = multiSelectedLocations.some((item) => item.locationName === location.name);
    return `
      <button class="location ${selected ? "selected" : ""}" type="button" data-index="${index}">
        <strong>${location.title || location.name}</strong>
        <small>${location.address || location.name}</small>
      </button>
    `;
  }).join("");
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
    $("#multiPostForm").elements.imageUrl.value = absoluteImage;
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
    renderMultiLocations();
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

$("#loadMultiLocations").addEventListener("click", async () => {
  const list = $("#multiLocationsList");
  list.textContent = "Loading profiles...";
  try {
    const result = await getJson("/api/google-locations");
    googleLocations = result.locations || [];
    updateDesignerProfiles();
    renderMultiLocations();
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

$("#multiLocationsList").addEventListener("click", (event) => {
  const button = event.target.closest(".location");
  if (!button) return;
  const location = googleLocations[Number(button.dataset.index)];
  if (!location) return;
  const existing = multiSelectedLocations.findIndex((item) => item.locationName === location.name);
  if (existing >= 0) {
    multiSelectedLocations.splice(existing, 1);
  } else {
    multiSelectedLocations.push({
      title: location.title,
      locationName: location.name,
      accountName: location.accountName
    });
  }
  renderMultiLocations();
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

$("#uploadPosterImage").addEventListener("click", async () => {
  const form = $("#postForm");
  const file = form.elements.posterUpload.files[0];
  if (!file) {
    $("#postStatus").textContent = "Choose a PNG, JPG, or WebP image first.";
    return;
  }

  $("#postStatus").textContent = "Uploading image...";
  try {
    const image = await fileToDataUrl(file);
    const result = await postJson("/api/upload-image", { image });
    form.elements.imageUrl.value = result.url;
    $("#postStatus").textContent = "Image uploaded. You can post it to Google now.";
  } catch (error) {
    $("#postStatus").textContent = error.message;
  }
});

$("#multiUploadButton").addEventListener("click", async () => {
  const form = $("#multiPostForm");
  const file = form.elements.multiUpload.files[0];
  if (!file) {
    $("#multiPostStatus").textContent = "Choose a PNG, JPG, or WebP image first.";
    return;
  }

  $("#multiPostStatus").textContent = "Uploading image...";
  try {
    const image = await fileToDataUrl(file);
    const result = await postJson("/api/upload-image", { image });
    form.elements.imageUrl.value = result.url;
    $("#multiPostStatus").textContent = "Image uploaded. Ready to post.";
  } catch (error) {
    $("#multiPostStatus").textContent = error.message;
  }
});

const savedFacebook = JSON.parse(localStorage.getItem("pcs.facebook") || "{}");
fillForm($("#multiPostForm"), savedFacebook);

$("#multiPostForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    ...formData(form),
    googleTargets: multiSelectedLocations
  };

  localStorage.setItem("pcs.facebook", JSON.stringify({
    facebookPageId: payload.facebookPageId,
    facebookPageAccessToken: payload.facebookPageAccessToken
  }));

  if (!payload.summary && !payload.imageUrl) {
    $("#multiPostStatus").textContent = "Add a caption or image before posting.";
    return;
  }
  if (!payload.facebookPageId && !multiSelectedLocations.length) {
    $("#multiPostStatus").textContent = "Add Facebook Page details or select at least one Google profile.";
    return;
  }

  $("#multiPostStatus").textContent = "Posting to Facebook and Google...";
  try {
    const result = await postJson("/api/multi-post", payload);
    $("#multiPostStatus").textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    $("#multiPostStatus").textContent = error.message;
  }
});

$("#clearGallery").addEventListener("click", () => {
  if (!confirm("Clear all saved posters from this browser?")) return;
  storage.gallery = [];
  renderGallery();
});

renderGallery();
