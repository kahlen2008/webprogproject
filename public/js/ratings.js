/**
 * ratings.js - Star ratings and comments on recipes (Person 3)
 * Handles displaying rating summaries, user reviews, and adding/editing/deleting reviews.
 */

import { getCurrentUser, onAuthChange } from "./auth.js";
import {
  saveRecipeRating,
  fetchRecipeRatings,
  fetchUserRating,
  deleteRecipeRating,
} from "./schema.js";
import { escapeHtml, showToast } from "./utils.js";

/**
 * Calculates rating statistics from a list of ratings
 */
export function calculateRatingStats(ratings = []) {
  if (!ratings.length) {
    return { count: 0, average: 0, roundedAvg: "0.0" };
  }
  const sum = ratings.reduce((acc, curr) => acc + (Number(curr.stars) || 0), 0);
  const avg = sum / ratings.length;
  return {
    count: ratings.length,
    average: avg,
    roundedAvg: avg.toFixed(1),
  };
}

/**
 * Returns star display with amber/gray stars
 */
export function renderStarDisplay(rating, maxStars = 5) {
  const rounded = Math.round(rating * 2) / 2; // round to nearest half
  let starsHtml = "";
  for (let i = 1; i <= maxStars; i++) {
    if (i <= rounded) {
      starsHtml += `<span class="text-amber-500">★</span>`;
    } else if (i - 0.5 === rounded) {
      starsHtml += `<span class="text-amber-400">★</span>`;
    } else {
      starsHtml += `<span class="text-stone-300">★</span>`;
    }
  }
  return starsHtml;
}

/**
 * Initializes and mounts the ratings section for a recipe.
 * @param {string} recipeId
 * @param {HTMLElement|string} targetElement
 */
export async function initRatings(recipeId, targetElement = "recipe-ratings-section") {
  const container =
    typeof targetElement === "string"
      ? document.getElementById(targetElement)
      : targetElement;

  if (!container || !recipeId) return;

  // Render container layout
  container.innerHTML = `
    <div class="mt-12 pt-8 border-t border-[#efe6dc] space-y-8" id="ratings-wrapper">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-stone-900 tracking-tight">Community Reviews</h2>
          <p class="text-sm text-stone-500 mt-1">See what other home cooks think or leave your own review.</p>
        </div>
        <div id="ratings-summary-badge" class="flex items-center gap-2 bg-[#fcf9f5] px-4 py-2 rounded-2xl border border-[#efe6dc]">
          <span class="text-xs text-stone-400">Loading ratings...</span>
        </div>
      </div>

      <!-- User Review Form / Box -->
      <div id="user-review-panel" class="bg-[#fcf9f5] rounded-2xl border border-[#efe6dc] p-5 sm:p-6 transition-all">
        <div class="text-center py-4 text-sm text-stone-400 animate-pulse">Checking sign-in status...</div>
      </div>

      <!-- Ratings List -->
      <div class="space-y-4">
        <h3 class="text-lg font-bold text-stone-900 flex items-center justify-between">
          <span>All Reviews</span>
          <span id="reviews-count-badge" class="text-xs font-normal text-stone-500"></span>
        </h3>
        <div id="reviews-list-container" class="space-y-3">
          <div class="text-center py-8 text-sm text-stone-400 animate-pulse">Loading reviews...</div>
        </div>
      </div>
    </div>
  `;

  // Local state for this recipe
  let currentRatings = [];
  let userRating = null;
  let currentUser = getCurrentUser();

  // Quick UI updater
  const updateSummaryUI = (ratings) => {
    const stats = calculateRatingStats(ratings);
    const badge = document.getElementById("ratings-summary-badge");
    const countBadge = document.getElementById("reviews-count-badge");
    const headerRating = document.getElementById("header-star-rating");

    if (badge) {
      if (stats.count === 0) {
        badge.innerHTML = `
          <span class="text-sm font-medium text-stone-500">No ratings yet</span>
        `;
      } else {
        badge.innerHTML = `
          <div class="flex items-center text-amber-500 text-sm tracking-tighter">
            ${renderStarDisplay(stats.average)}
          </div>
          <span class="text-sm font-bold text-stone-900">${stats.roundedAvg}</span>
          <span class="text-xs text-stone-500">(${stats.count} review${stats.count === 1 ? "" : "s"})</span>
        `;
      }
    }

    if (countBadge) {
      countBadge.textContent = stats.count > 0 ? `${stats.count} total` : "";
    }

    // Sync header ratings if present in recipe.html
    if (headerRating) {
      if (stats.count === 0) {
        headerRating.innerHTML = `
          <div class="flex items-center text-stone-300 text-sm">
            <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
          </div>
          <span class="text-sm text-stone-500">No ratings yet</span>
        `;
      } else {
        headerRating.innerHTML = `
          <div class="flex items-center text-amber-500 text-sm">
            ${renderStarDisplay(stats.average)}
          </div>
          <span class="text-sm font-semibold text-stone-800">${stats.roundedAvg}</span>
          <span class="text-sm text-stone-500">(${stats.count} rating${stats.count === 1 ? "" : "s"})</span>
        `;
      }
    }
  };

  // Render Reviews List
  const renderReviewsList = (ratings) => {
    const listContainer = document.getElementById("reviews-list-container");
    if (!listContainer) return;

    if (!ratings || ratings.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-[#efe6dc] p-6">
          <div class="w-12 h-12 mx-auto rounded-full bg-[#fbf2ec] text-[#ca5c2e] flex items-center justify-center mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          </div>
          <p class="font-semibold text-stone-700">No reviews yet</p>
          <p class="text-xs text-stone-500 mt-1 max-w-sm mx-auto">Be the first to share your thoughts, cooking tips, or tweaks for this recipe!</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = ratings
      .map((r) => {
        const isAuthor = currentUser && currentUser.uid === r.uid;
        const authorBadge = isAuthor
          ? `<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fbf2ec] text-[#ca5c2e]">You</span>`
          : "";
        const formattedDate = r.createdAt?.toDate
          ? r.createdAt.toDate().toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Recently";

        return `
          <div class="bg-white rounded-2xl border border-[#efe6dc] p-4 sm:p-5 transition hover:border-stone-300">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-semibold text-sm text-stone-900">${escapeHtml(r.displayName || "Anonymous")}</span>
                  ${authorBadge}
                  <span class="text-xs text-stone-400">&bull;</span>
                  <span class="text-xs text-stone-400">${formattedDate}</span>
                </div>
                <div class="flex items-center text-amber-500 text-sm mt-1">
                  ${renderStarDisplay(r.stars)}
                </div>
              </div>
              ${
                isAuthor
                  ? `
                <div class="flex items-center gap-1">
                  <button id="btn-edit-inline" class="text-xs font-semibold text-stone-500 hover:text-[#ca5c2e] p-1.5 rounded-lg hover:bg-[#faf7f2] transition" title="Edit your review">
                    Edit
                  </button>
                  <button id="btn-delete-inline" class="text-xs font-semibold text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition" title="Delete review">
                    Delete
                  </button>
                </div>
              `
                  : ""
              }
            </div>
            ${
              r.comment
                ? `<p class="text-sm text-stone-700 mt-3 whitespace-pre-line leading-relaxed">${escapeHtml(r.comment)}</p>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    // Wire up inline edit and delete buttons
    const editBtn = document.getElementById("btn-edit-inline");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        renderFormState(true);
        document.getElementById("user-review-panel")?.scrollIntoView({ behavior: "smooth" });
      });
    }

    const deleteBtn = document.getElementById("btn-delete-inline");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", handleDeleteReview);
    }
  };

  // Render the User Review Box (Form vs Prompt vs Summary)
  const renderFormState = (isEditing = false) => {
    const panel = document.getElementById("user-review-panel");
    if (!panel) return;

    // Logged Out
    if (!currentUser) {
      panel.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white border border-[#efe6dc] flex items-center justify-center text-stone-400 shrink-0">
              <svg class="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-stone-800">Want to rate this recipe?</p>
              <p class="text-xs text-stone-500">Sign in to leave a star rating and share your review.</p>
            </div>
          </div>
          <a href="login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" 
             class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#ca5c2e] hover:bg-[#b04d24] rounded-xl transition shadow-xs shrink-0">
            Log In to Rate
          </a>
        </div>
      `;
      return;
    }

    // User already has a review and isn't editing it right now
    if (userRating && !isEditing) {
      panel.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-stone-500 uppercase tracking-wide">Your Review</span>
              <div class="flex items-center text-amber-500 text-sm">
                ${renderStarDisplay(userRating.stars)}
              </div>
            </div>
            ${
              userRating.comment
                ? `<p class="text-sm text-stone-700 mt-2 font-medium">"${escapeHtml(userRating.comment)}"</p>`
                : `<p class="text-xs text-stone-400 mt-1 italic">No written comment</p>`
            }
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="btn-edit-review" class="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-[#efe6dc] hover:border-stone-400 rounded-xl transition shadow-2xs">
              Edit Review
            </button>
            <button id="btn-delete-review" class="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-[#efe6dc] hover:bg-red-50 hover:border-red-200 rounded-xl transition shadow-2xs">
              Delete
            </button>
          </div>
        </div>
      `;

      document.getElementById("btn-edit-review")?.addEventListener("click", () => renderFormState(true));
      document.getElementById("btn-delete-review")?.addEventListener("click", handleDeleteReview);
      return;
    }

    // Form: Creating or editing a review
    const initialStars = userRating ? userRating.stars : 5;
    const initialComment = userRating ? userRating.comment || "" : "";

    panel.innerHTML = `
      <form id="rating-form" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 class="text-sm font-bold text-stone-900">
            ${userRating ? "Edit Your Review" : "Leave a Review"}
          </h4>
          <span class="text-xs text-stone-500">Posting as <strong>${escapeHtml(currentUser.displayName || currentUser.email?.split("@")[0] || "Home Cook")}</strong></span>
        </div>

        <!-- Star Selection -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1.5">Rating (1 to 5 stars)</label>
          <div class="flex items-center gap-1" id="star-input-group" role="radiogroup" aria-label="Select star rating">
            ${[1, 2, 3, 4, 5]
              .map(
                (star) => `
              <button 
                type="button" 
                data-star="${star}" 
                role="radio"
                aria-checked="${star === initialStars}"
                aria-label="${star} star${star > 1 ? "s" : ""}"
                class="star-pick-btn w-9 h-9 rounded-xl flex items-center justify-center text-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#ca5c2e]/40 ${
                  star <= initialStars ? "text-amber-500" : "text-stone-300"
                }">
                ★
              </button>
            `
              )
              .join("")}
            <span id="star-rating-hint" class="ml-2 text-xs font-bold text-amber-600">
              ${initialStars} out of 5
            </span>
          </div>
          <input type="hidden" id="selected-stars-value" value="${initialStars}">
        </div>

        <!-- Comment Input -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label for="rating-comment" class="block text-xs font-semibold text-stone-600">
              Comment <span class="font-normal text-stone-400">(optional)</span>
            </label>
            <span id="comment-char-counter" class="text-[11px] text-stone-400">0/300</span>
          </div>
          <textarea 
            id="rating-comment" 
            maxlength="300" 
            rows="3" 
            placeholder="What did you like about this recipe? Any ingredients you modified?" 
            class="w-full text-sm rounded-xl border border-[#efe6dc] bg-white p-3 text-stone-800 placeholder-stone-400 focus:border-[#ca5c2e] focus:ring-2 focus:ring-[#ca5c2e]/20 outline-none transition resize-none"
          >${escapeHtml(initialComment)}</textarea>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2 pt-1">
          ${
            userRating
              ? `
            <button 
              type="button" 
              id="btn-cancel-edit" 
              class="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 bg-white border border-[#efe6dc] rounded-xl hover:bg-stone-50 transition">
              Cancel
            </button>
          `
              : ""
          }
          <button 
            type="submit" 
            id="btn-submit-review" 
            class="px-5 py-2 text-xs font-semibold text-white bg-[#ca5c2e] hover:bg-[#b04d24] rounded-xl transition shadow-xs flex items-center gap-2">
            <span>${userRating ? "Update Review" : "Submit Review"}</span>
          </button>
        </div>
      </form>
    `;

    // Interactivity for star selector
    let selectedStars = initialStars;
    const starBtns = panel.querySelectorAll(".star-pick-btn");
    const starsValueInput = document.getElementById("selected-stars-value");
    const starsHint = document.getElementById("star-rating-hint");

    const updateStarSelectorUI = (stars) => {
      starBtns.forEach((btn) => {
        const starVal = Number(btn.getAttribute("data-star"));
        if (starVal <= stars) {
          btn.classList.add("text-amber-500");
          btn.classList.remove("text-stone-300");
          btn.setAttribute("aria-checked", "true");
        } else {
          btn.classList.remove("text-amber-500");
          btn.classList.add("text-stone-300");
          btn.setAttribute("aria-checked", "false");
        }
      });
      if (starsHint) starsHint.textContent = `${stars} out of 5`;
      if (starsValueInput) starsValueInput.value = stars;
    };

    starBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedStars = Number(btn.getAttribute("data-star"));
        updateStarSelectorUI(selectedStars);
      });
      btn.addEventListener("mouseenter", () => {
        const hoverVal = Number(btn.getAttribute("data-star"));
        updateStarSelectorUI(hoverVal);
      });
    });

    panel.querySelector("#star-input-group")?.addEventListener("mouseleave", () => {
      updateStarSelectorUI(selectedStars);
    });

    // Character counter
    const commentInput = document.getElementById("rating-comment");
    const counter = document.getElementById("comment-char-counter");
    if (commentInput && counter) {
      counter.textContent = `${commentInput.value.length}/300`;
      commentInput.addEventListener("input", () => {
        counter.textContent = `${commentInput.value.length}/300`;
      });
    }

    // Cancel edit
    document.getElementById("btn-cancel-edit")?.addEventListener("click", () => {
      renderFormState(false);
    });

    // Form submit
    document.getElementById("rating-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-review");
      const stars = Number(document.getElementById("selected-stars-value")?.value || 5);
      const comment = (document.getElementById("rating-comment")?.value || "").trim();
      const displayName =
        currentUser.displayName || currentUser.email?.split("@")[0] || "Home Cook";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Saving...`;
      }

      try {
        await saveRecipeRating(recipeId, currentUser.uid, {
          stars,
          comment,
          displayName,
        });

        showToast(userRating ? "Review updated!" : "Thank you for your rating!");
        
        // Refresh local cache & UI
        await reloadData();
      } catch (err) {
        console.error("Failed to save rating:", err);
        showToast("Error saving review. Please try again.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Submit Review`;
        }
      }
    });
  };

  // Delete review handler
  const handleDeleteReview = async () => {
    if (!currentUser || !userRating) return;
    if (!confirm("Are you sure you want to delete your review?")) return;

    try {
      await deleteRecipeRating(recipeId, currentUser.uid);
      showToast("Review deleted");
      userRating = null;
      await reloadData();
    } catch (err) {
      console.error("Failed to delete review:", err);
      showToast("Error deleting review. Please try again.");
    }
  };

  // Full data fetch and reload
  const reloadData = async () => {
    try {
      const [allRatings, myRating] = await Promise.all([
        fetchRecipeRatings(recipeId),
        currentUser ? fetchUserRating(recipeId, currentUser.uid) : Promise.resolve(null),
      ]);

      currentRatings = allRatings || [];
      userRating = myRating;

      updateSummaryUI(currentRatings);
      renderReviewsList(currentRatings);
      renderFormState(false);
    } catch (err) {
      console.error("Error loading recipe ratings:", err);
      const listContainer = document.getElementById("reviews-list-container");
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center py-6 text-sm text-stone-500">
            Unable to load reviews right now. Please try refreshing.
          </div>
        `;
      }
    }
  };

  // Listen for auth state changes to dynamically update form state
  onAuthChange((user) => {
    currentUser = user;
    reloadData();
  });

  // Initial load
  await reloadData();
}
