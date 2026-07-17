"use server";

import { checkUser } from "@/lib/checkUser";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

// Get all meal plans for a user between two dates (inclusive), populated with recipe data
export async function getMealPlans(startDate, endDate) {
  try {
    const user = await checkUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(
      `${STRAPI_URL}/api/meal-plans?filters[user][id][$eq]=${user.id}&filters[date][$gte]=${startDate}&filters[date][$lte]=${endDate}&populate[recipe][populate]=*&sort=date:asc`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch meal plans:", errorText);
      throw new Error("Failed to fetch meal plans");
    }

    const data = await response.json();

    return {
      success: true,
      mealPlans: data.data || [],
    };
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    throw new Error(error.message || "Failed to load meal plans");
  }
}

// Add a recipe to a specific day + meal slot
export async function addMealToDay(formData) {
  try {
    const user = await checkUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const recipeId = formData.get("recipeId");
    const date = formData.get("date");
    const mealType = formData.get("mealType");

    if (!recipeId || !date || !mealType) {
      throw new Error("Recipe, date, and meal type are required");
    }

    const response = await fetch(`${STRAPI_URL}/api/meal-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          date,
          mealType,
          recipe: recipeId,
          user: user.id,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to add meal:", errorText);
      throw new Error("Failed to add meal to plan");
    }

    const data = await response.json();

    return {
      success: true,
      mealPlan: data.data,
      message: "Added to your meal plan!",
    };
  } catch (error) {
    console.error("Error adding meal to day:", error);
    throw new Error(error.message || "Failed to add meal");
  }
}

// Remove a meal plan entry
export async function removeMealFromDay(formData) {
  try {
    const user = await checkUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const mealPlanId = formData.get("mealPlanId");

    const response = await fetch(
      `${STRAPI_URL}/api/meal-plans/${mealPlanId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to remove meal");
    }

    return {
      success: true,
      message: "Removed from your meal plan",
    };
  } catch (error) {
    console.error("Error removing meal:", error);
    throw new Error(error.message || "Failed to remove meal");
  }
}

// Generate an aggregated shopping list from all recipes planned between two dates
export async function generateShoppingList(startDate, endDate) {
  try {
    const { mealPlans } = await getMealPlans(startDate, endDate);

    // Collect every ingredient across every planned recipe
    const allIngredients = mealPlans
      .map((plan) => plan.recipe?.ingredients || [])
      .flat();

    // Aggregate by ingredient name (case-insensitive), keep list of source amounts
    const aggregated = {};
    for (const ing of allIngredients) {
      if (!ing?.item) continue;
      const key = ing.item.trim().toLowerCase();
      if (!aggregated[key]) {
        aggregated[key] = {
          item: ing.item.trim(),
          category: ing.category || "Other",
          amounts: [],
        };
      }
      if (ing.amount) {
        aggregated[key].amounts.push(ing.amount);
      }
    }

    // Group into categories for a shopping-aisle-style list
    const grouped = {};
    for (const entry of Object.values(aggregated)) {
      const cat = entry.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        item: entry.item,
        // Combine amounts from multiple recipes (e.g. "2 cups, 1 tbsp")
        amount: entry.amounts.join(" + "),
      });
    }

    return {
      success: true,
      shoppingList: grouped,
      recipeCount: new Set(mealPlans.map((p) => p.recipe?.id)).size,
    };
  } catch (error) {
    console.error("Error generating shopping list:", error);
    throw new Error(error.message || "Failed to generate shopping list");
  }
}
