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
import { escapeHtml, showToast, showAuthPromptModal, showConfirmModal } from "./utils.js";

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
  const rounded = Math.round(rating * 2) / 2;
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

  // Render two-column layout: Summary sidebar (left) + Reviews list (right)
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10" id="ratings-wrapper">
      <!-- Summary card -->
      <aside class="md:col-span-4">
        <div class="bg-[#fcf9f5] rounded-2xl border border-[#efe6dc] p-5 sm:p-6 space-y-5" style="position:sticky;top:6rem">
          <div id="ratings-summary-badge">
            <span class="text-xs text-stone-400">Loading ratings...</span>
          </div>
          <div id="ratings-distribution" class="space-y-1.5"></div>
          <div class="pt-4 border-t border-[#efe6dc] space-y-3">
            <p class="text-sm text-stone-600 leading-snug">Cooked this? Share your rating and any tweaks with other home cooks.</p>
            <button type="button" id="btn-open-review" class="open-review-btn w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#ca5c2e] hover:bg-[#b04d24] rounded-xl transition shadow-xs">
              <span aria-hidden="true">★</span>
              <span class="open-review-label">Write a Review</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Reviews list -->
      <div class="md:col-span-8 space-y-3">
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

  container.querySelector("#btn-open-review")?.addEventListener("click", () => {
    openReviewModal();
  });

  // Keep every "Write a review" button label in sync with the user's state
  const updateOpenButtons = () => {
    document.querySelectorAll(".open-review-label").forEach((label) => {
      const isHeader = Boolean(label.closest("#header-star-rating"));
      if (userRating) {
        label.textContent = isHeader ? "Edit your review" : "Edit Your Review";
      } else {
        label.textContent = isHeader ? "Write a review" : "Write a Review";
      }
    });
  };

  // Update summary card, distribution bars, tab badge, and header stars
  const updateSummaryUI = (ratings) => {
    const stats = calculateRatingStats(ratings);
    const badge = document.getElementById("ratings-summary-badge");
    const dist = document.getElementById("ratings-distribution");
    const tabCount = document.getElementById("reviews-tab-count");
    const headerRating = document.getElementById("header-star-rating");

    if (badge) {
      badge.innerHTML = `
        <p class="text-xs font-bold text-stone-500 uppercase tracking-wide">Community Rating</p>
        <div class="flex items-end gap-3 mt-1">
          <span class="font-extrabold text-stone-900 leading-none" style="font-size:3rem">${stats.count ? stats.roundedAvg : "–"}</span>
          <div class="pb-1">
            <div class="flex items-center text-lg leading-none">${renderStarDisplay(stats.average)}</div>
            <p class="text-xs text-stone-500 mt-1">${
              stats.count
                ? `Based on ${stats.count} review${stats.count === 1 ? "" : "s"}`
                : "No reviews yet"
            }</p>
          </div>
        </div>
      `;
    }

    if (dist) {
      dist.innerHTML = [5, 4, 3, 2, 1]
        .map((starLevel) => {
          const countForStar = ratings.filter(
            (r) => Math.round(Number(r.stars)) === starLevel
          ).length;
          const pct = stats.count ? Math.round((countForStar / stats.count) * 100) : 0;
          return `
            <div class="flex items-center gap-2 text-xs">
              <span class="inline-flex items-center font-semibold text-stone-600 shrink-0" style="width:2rem;gap:3px;font-variant-numeric:tabular-nums">
                <span style="display:inline-block;width:0.75rem;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-variant-numeric:tabular-nums">${starLevel}</span>
                <span style="display:inline-block;width:0.85rem;text-align:center;line-height:1">★</span>
              </span>
              <div class="flex-1 rounded-full bg-[#efe6dc] overflow-hidden" style="height:0.5rem">
                <div class="h-full rounded-full bg-amber-500" style="width:${pct}%"></div>
              </div>
              <span class="text-right text-stone-400 shrink-0" style="display:inline-block;width:1.5rem;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-variant-numeric:tabular-nums">${countForStar}</span>
            </div>
          `;
        })
        .join("");
    }

    if (tabCount) {
      tabCount.textContent = String(stats.count);
    }

    if (headerRating) {
      const summaryInner =
        stats.count === 0
          ? `<span class="flex items-center text-stone-300 text-sm"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></span>
             <span class="text-sm text-stone-500">No reviews yet</span>`
          : `<span class="flex items-center text-amber-500 text-sm">${renderStarDisplay(stats.average)}</span>
             <span class="text-sm font-semibold text-stone-800">${stats.roundedAvg}</span>
             <span class="text-sm text-stone-500">(${stats.count} review${stats.count === 1 ? "" : "s"})</span>`;

      headerRating.innerHTML = `
        <button type="button" id="header-rating-jump" class="inline-flex items-center gap-2 rounded-lg hover:underline focus:outline-none" title="See reviews">
          ${summaryInner}
        </button>
        <span class="text-stone-300" aria-hidden="true">·</span>
        <button type="button" class="open-review-btn text-sm font-semibold text-[#ca5c2e] hover:text-[#b04d24] hover:underline transition focus:outline-none">
          <span class="open-review-label">${userRating ? "Edit your review" : "Write a review"}</span>
        </button>
      `;

      headerRating.querySelector("#header-rating-jump")?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("recipe:show-reviews"));
      });
      headerRating.querySelector(".open-review-btn")?.addEventListener("click", () => {
        openReviewModal();
      });
    }

    updateOpenButtons();
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

    const sorted = [...ratings].sort((a, b) => {
      const mine = (r) => (currentUser && r.uid === currentUser.uid ? 1 : 0);
      return mine(b) - mine(a);
    });

    listContainer.innerHTML = sorted
      .map((r) => {
        const isAuthor = Boolean(currentUser && currentUser.uid === r.uid);
        const authorBadge = isAuthor
          ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ca5c2e] text-white">You</span>`
          : "";
        const name = r.displayName || "Anonymous";
        const initial = escapeHtml(name.trim().charAt(0).toUpperCase() || "?");
        const formattedDate = r.createdAt?.toDate
          ? r.createdAt.toDate().toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Recently";

        const cardClasses = isAuthor
          ? "rounded-2xl border p-4 sm:p-5 transition bg-[#fcf9f5] border-[#ca5c2e]"
          : "rounded-2xl border p-4 sm:p-5 transition bg-white border-[#efe6dc] hover:border-stone-300";

        const avatarClasses = isAuthor
          ? "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-[#ca5c2e] text-white"
          : "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-[#fbf2ec] text-[#ca5c2e]";

        const actionsHtml = isAuthor
          ? `
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" id="btn-edit-inline" class="text-xs font-semibold text-stone-600 hover:text-[#ca5c2e] px-2.5 py-1 rounded-lg bg-white border border-[#efe6dc] hover:border-stone-400 transition" title="Edit your review">
                Edit
              </button>
              <button type="button" id="btn-delete-inline" class="text-xs font-semibold text-red-500 hover:text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-50 transition" title="Delete review">
                Delete
              </button>
            </div>
          `
          : "";

        const commentHtml = r.comment
          ? `<p class="text-sm text-stone-700 mt-2 whitespace-pre-line leading-relaxed">${escapeHtml(r.comment)}</p>`
          : `<p class="text-xs text-stone-400 mt-2 italic">No written comment</p>`;

        return `
          <div class="${cardClasses}">
            <div class="flex items-start gap-3">
              <div class="${avatarClasses}">${initial}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-semibold text-sm text-stone-900">${escapeHtml(name)}</span>
                      ${authorBadge}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="flex items-center text-sm leading-none">${renderStarDisplay(r.stars)}</span>
                      <span class="text-xs text-stone-400">${formattedDate}</span>
                    </div>
                  </div>
                  ${actionsHtml}
                </div>
                ${commentHtml}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Wire up inline edit and delete buttons
    const editBtn = document.getElementById("btn-edit-inline");
    if (editBtn) {
      editBtn.addEventListener("click", () => openReviewModal());
    }

    const deleteBtn = document.getElementById("btn-delete-inline");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", handleDeleteReview);
    }
  };

  // Close the review popup
  const closeReviewModal = () => {
    const modal = document.getElementById("review-modal");
    if (!modal) return;
    if (modal._onKey) {
      document.removeEventListener("keydown", modal._onKey);
    }
    modal.classList.remove("opacity-100");
    modal.querySelector(".review-dialog")?.classList.remove("scale-100", "opacity-100");
    document.body.style.overflow = "";
    setTimeout(() => modal.remove(), 200);
  };

  // Form: creating or editing a review (rendered inside the popup)
  const renderReviewForm = (panel) => {
    if (!panel || !currentUser) return;

    const initialStars = userRating ? Number(userRating.stars) || 5 : 5;
    const initialComment = userRating ? userRating.comment || "" : "";
    const authorLabel = escapeHtml(
      currentUser.displayName || currentUser.email?.split("@")[0] || "Home Cook"
    );

    const starButtonsHtml = [1, 2, 3, 4, 5]
      .map((star) => {
        const isSelected = star <= initialStars;
        const colorClass = isSelected ? "text-amber-500" : "text-stone-300";
        return `
          <button
            type="button"
            data-star="${star}"
            role="radio"
            aria-checked="${star === initialStars}"
            aria-label="${star} star${star > 1 ? "s" : ""}"
            class="star-pick-btn w-9 h-9 rounded-xl flex items-center justify-center text-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#ca5c2e]/40 ${colorClass}">
            ★
          </button>
        `;
      })
      .join("");

    panel.innerHTML = `
      <form id="rating-form" class="space-y-4">
        <div style="padding-right:2.5rem">
          <h4 class="text-lg font-bold text-stone-900">
            ${userRating ? "Edit Your Review" : "Leave a Review"}
          </h4>
          <span class="text-xs text-stone-500">Posting as <strong>${authorLabel}</strong></span>
        </div>

        <!-- Star Selection -->
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1.5">Rating (1 to 5 stars)</label>
          <div class="flex items-center gap-1" id="star-input-group" role="radiogroup" aria-label="Select star rating">
            ${starButtonsHtml}
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
          <button
            type="button"
            id="btn-cancel-edit"
            class="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 bg-white border border-[#efe6dc] rounded-xl hover:bg-stone-50 transition">
            Cancel
          </button>
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
    const starsValueInput = panel.querySelector("#selected-stars-value");
    const starsHint = panel.querySelector("#star-rating-hint");

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
      if (starsValueInput) starsValueInput.value = String(stars);
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
    const commentInput = panel.querySelector("#rating-comment");
    const counter = panel.querySelector("#comment-char-counter");
    if (commentInput && counter) {
      counter.textContent = `${commentInput.value.length}/300`;
      commentInput.addEventListener("input", () => {
        counter.textContent = `${commentInput.value.length}/300`;
      });
    }

    // Cancel
    panel.querySelector("#btn-cancel-edit")?.addEventListener("click", closeReviewModal);

    // Form submit
    panel.querySelector("#rating-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = panel.querySelector("#btn-submit-review");
      const stars = Number(starsValueInput?.value || 5);
      const comment = (commentInput?.value || "").trim();
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
        closeReviewModal();
        await reloadData();
      } catch (err) {
        console.error("Failed to save rating:", err);
        showToast("Error saving review. Please try again.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>${userRating ? "Update Review" : "Submit Review"}</span>`;
        }
      }
    });
  };

  // Open the review form in a popup (or ask the user to log in)
  function openReviewModal() {
    if (!currentUser) {
      showAuthPromptModal({
        title: "Log in to review",
        description: "Sign in to leave a star rating and share your tips with other home cooks.",
      });
      return;
    }

    document.getElementById("review-modal")?.remove();
    const modal = document.createElement("div");
    modal.id = "review-modal";
    modal.className =
      "fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs opacity-0 transition-opacity duration-200";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="review-dialog relative bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#efe6dc] scale-95 opacity-0 transition-all duration-200">
        <button type="button" id="review-modal-close" class="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition focus:outline-none" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <div id="review-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeReviewModal();
    });
    modal.querySelector("#review-modal-close")?.addEventListener("click", closeReviewModal);
    modal._onKey = (e) => {
      if (e.key === "Escape") closeReviewModal();
    };
    document.addEventListener("keydown", modal._onKey);

    renderReviewForm(modal.querySelector("#review-modal-body"));

    requestAnimationFrame(() => {
      modal.classList.add("opacity-100");
      modal.querySelector(".review-dialog")?.classList.add("scale-100", "opacity-100");
      modal.querySelector("#rating-comment")?.focus({ preventScroll: true });
    });
  }

  // Delete review handler
  const handleDeleteReview = async () => {
    if (!currentUser || !userRating) return;
    const confirmed = await showConfirmModal({
      title: "Delete Review?",
      message: "Are you sure you want to delete your review?",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmColor: "danger",
    });
    if (!confirmed) return;

    const previousRating = { ...userRating };

    try {
      await deleteRecipeRating(recipeId, currentUser.uid);
      userRating = null;
      await reloadData();

      showToast("Review deleted", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await saveRecipeRating(recipeId, currentUser.uid, {
                stars: previousRating.stars,
                comment: previousRating.comment || "",
                displayName:
                  previousRating.displayName ||
                  currentUser.displayName ||
                  "Home Cook",
              });
              showToast("Review restored!");
              await reloadData();
            } catch (restoreErr) {
              console.error("Failed to restore review:", restoreErr);
              showToast("Error restoring review. Please try again.");
            }
          },
        },
      });
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
      updateOpenButtons();
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

  // Listen for auth state changes to dynamically update state
  onAuthChange((user) => {
    currentUser = user;
    reloadData();
  });

  // Initial load
  await reloadData();
}
