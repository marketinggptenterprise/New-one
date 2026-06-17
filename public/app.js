const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const storage = {
  get profile() {
    return JSON.parse(localStorage.getItem("pcs.profile") || "{}");
  },
  set profile(value) {
    localStorage.setItem("pcs.profile", JSON.stringify(value));
  }
};

let googleLocations = [];
let googleReviews = [];

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
}

function profileLabel(location) {
  return `${location.title || location.name}${location.address ? ` - ${location.address}` : ""}`;
}

function updateCopyProfiles() {
  const select = $("#copyProfileSelect");
  const currentValue = select.value;
  select.innerHTML = '<option value="">Manual business details</option>' + googleLocations.map((location, index) => (
    `<option value="${index}">${profileLabel(location)}</option>`
  )).join("");
  select.value = currentValue;
  updateReviewProfiles();
}

function updateReviewProfiles() {
  const select = $("#reviewProfileSelect");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">Choose a business</option>' + googleLocations.map((location, index) => (
    `<option value="${index}">${profileLabel(location)}</option>`
  )).join("");
  select.value = currentValue;
}

function applyProfileToCopy(location) {
  const form = $("#copyForm");
  form.elements.businessName.value = location.title || "";
  form.elements.location.value = location.address || "";
  if (!form.elements.industry.value) form.elements.industry.value = "Local business";
  storage.profile = formData(form);
}

function renderGoogleLocations(list, locations) {
  if (!locations.length) {
    list.textContent = "No Google Business Profile locations were found for this account.";
    return;
  }
  list.innerHTML = locations.map((location, index) => `
    <button class="location" type="button" data-index="${index}">
      <strong>${location.title || location.name}</strong>
      <small>${location.address || location.name}</small>
    </button>
  `).join("");
}

function reviewDisplayName(review) {
  return review.reviewer?.displayName || review.reviewer?.profilePhotoUrl || "Customer";
}

function reviewRating(review) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[review.starRating] || review.starRating || "";
}

function renderReviews(reviews) {
  const list = $("#reviewsList");
  if (!reviews.length) {
    list.textContent = "No reviews found for this profile.";
    return;
  }
  list.innerHTML = reviews.map((review, index) => `
    <button class="location review-card" type="button" data-index="${index}">
      <strong>${reviewDisplayName(review)} - ${reviewRating(review)} stars</strong>
      <small>${review.comment || "No written review"}</small>
    </button>
  `).join("");
}

async function loadGoogleLocations(statusTarget) {
  statusTarget.textContent = "Loading profiles...";
  const result = await getJson("/api/google-locations");
  googleLocations = result.locations || [];
  updateCopyProfiles();
  return googleLocations;
}

$$(".nav").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

fillForm($("#copyForm"), storage.profile);

$("#loadCopyProfiles").addEventListener("click", async () => {
  const output = $("#copyOutput");
  try {
    await loadGoogleLocations(output);
    output.textContent = "Business profiles loaded. Choose one from the dropdown.";
  } catch (error) {
    output.textContent = error.message;
  }
});

$("#loadReviewProfiles").addEventListener("click", async () => {
  const status = $("#reviewsList");
  try {
    await loadGoogleLocations(status);
    status.textContent = "Business profiles loaded. Choose one from the dropdown.";
  } catch (error) {
    status.textContent = error.message;
  }
});

$("#copyProfileSelect").addEventListener("change", (event) => {
  const index = event.target.value;
  if (index === "") return;
  const location = googleLocations[Number(index)];
  if (location) applyProfileToCopy(location);
});

$("#copyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#copyOutput").textContent = "Generating copy...";
  try {
    const payload = formData(event.currentTarget);
    storage.profile = payload;
    const result = await postJson("/api/generate-copy", payload);
    $("#copyOutput").textContent = result.text;
  } catch (error) {
    $("#copyOutput").textContent = error.message;
  }
});

$("#loadLocations").addEventListener("click", async () => {
  const list = $("#locationsList");
  try {
    const locations = await loadGoogleLocations(list);
    renderGoogleLocations(list, locations);
  } catch (error) {
    list.textContent = error.message;
  }
});

$("#loadReviews").addEventListener("click", async () => {
  const selectedIndex = $("#reviewProfileSelect").value;
  const selected = googleLocations[Number(selectedIndex)];
  const list = $("#reviewsList");
  if (!selected) {
    list.textContent = "Choose a business first.";
    return;
  }

  list.textContent = "Loading reviews...";
  try {
    const params = new URLSearchParams({
      accountName: selected.accountName,
      locationName: selected.name
    });
    const result = await getJson(`/api/google-reviews?${params.toString()}`);
    googleReviews = result.reviews || [];
    renderReviews(googleReviews);
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
  const form = $("#postForm");
  form.elements.locationName.value = location.name;
  form.elements.accountName.value = location.accountName;
});

$("#reviewsList").addEventListener("click", (event) => {
  const button = event.target.closest(".review-card");
  if (!button) return;
  $$("#reviewsList .review-card").forEach((item) => item.classList.toggle("active", item === button));

  const review = googleReviews[Number(button.dataset.index)];
  const profile = googleLocations[Number($("#reviewProfileSelect").value)];
  if (!review || !profile) return;

  const form = $("#reviewReplyForm");
  form.elements.reviewText.value = review.comment || "No written review";
  form.elements.accountName.value = profile.accountName;
  form.elements.locationName.value = profile.name;
  form.elements.businessName.value = profile.title || "";
  form.elements.reviewId.value = review.name || review.reviewId || "";
  form.elements.rating.value = reviewRating(review);
  form.elements.reviewer.value = reviewDisplayName(review);
  form.elements.comment.value = review.reviewReply?.comment || "";
  $("#reviewReplyStatus").textContent = review.reviewReply?.comment
    ? "This review already has a reply. Edit and post to update it."
    : "Review selected.";
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

$("#generateReviewReply").addEventListener("click", async () => {
  const form = $("#reviewReplyForm");
  if (!form.elements.reviewId.value) {
    $("#reviewReplyStatus").textContent = "Choose a review first.";
    return;
  }

  $("#reviewReplyStatus").textContent = "Generating AI reply...";
  try {
    const result = await postJson("/api/generate-review-reply", formData(form));
    form.elements.comment.value = result.text;
    $("#reviewReplyStatus").textContent = result.fallback
      ? "Fallback reply generated. Edit before posting."
      : "AI reply generated. Edit before posting.";
  } catch (error) {
    $("#reviewReplyStatus").textContent = error.message;
  }
});

$("#reviewReplyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#reviewReplyStatus").textContent = "Posting reply...";
  try {
    await postJson("/api/google-review-reply", formData(event.currentTarget));
    $("#reviewReplyStatus").textContent = "Reply posted successfully.";
  } catch (error) {
    $("#reviewReplyStatus").textContent = error.message;
  }
});
