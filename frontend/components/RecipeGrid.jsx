"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Sparkles, ChefHat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import useFetch from "@/hooks/use-fetch";
import RecipeCard from "@/components/RecipeCard";
import { suggestCuisineDishes } from "@/actions/recipe.actions";

export default function RecipeGrid({
  type, // "category" or "cuisine"
  value, // actual category/cuisine name
  fetchAction, // server action to fetch meals
  backLink = "/dashboard",
}) {
  const router = useRouter();
  const { loading, data, fn: fetchMeals } = useFetch(fetchAction);
  const {
    loading: loadingSuggestions,
    data: suggestionsData,
    fn: fetchSuggestions,
  } = useFetch(suggestCuisineDishes);
  const [generatingDish, setGeneratingDish] = useState(null);

  useEffect(() => {
    if (value) {
      fetchMeals(value);
    }
  }, [value]);

  const meals = data?.meals || [];
  const displayName = value?.replace(/-/g, " "); // Convert "saudi-arabian" to "saudi arabian"

  // If this is a cuisine page and TheMealDB has nothing for it, fall back
  // to AI-suggested authentic dishes so no cuisine is ever a dead end.
  useEffect(() => {
    if (!loading && type === "cuisine" && meals.length === 0 && value) {
      fetchSuggestions(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, meals.length, type, value]);

  const handleGenerateDish = (dishName) => {
    setGeneratingDish(dishName);
    router.push(`/recipe?cook=${encodeURIComponent(dishName)}`);
  };

  const suggestions = suggestionsData?.dishes || [];
  const showAiFallback =
    type === "cuisine" && !loading && meals.length === 0;

  return (
    <div className="min-h-screen bg-stone-50 pt-14 pb-16 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={backLink}
            className="inline-flex items-center gap-2 text-stone-600 hover:text-orange-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <h1 className="text-5xl md:text-6xl font-bold text-stone-900 capitalize tracking-tight leading-tight">
            {displayName}{" "}
            <span className="text-orange-600">
              {type === "cuisine" ? "Cuisine" : "Recipes"}
            </span>
          </h1>

          {!loading && meals.length > 0 && (
            <p className="text-stone-600 mt-2">
              {meals.length} delicious {displayName}{" "}
              {type === "cuisine" ? "dishes" : "recipes"} to try
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col justify-center items-center py-20">
            <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-4" />
            <p className="text-stone-500">Loading recipes...</p>
          </div>
        )}

        {/* Meals Grid - Using RecipeCard */}
        {!loading && meals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {meals.map((meal) => (
              <RecipeCard key={meal.idMeal} recipe={meal} variant="grid" />
            ))}
          </div>
        )}

        {/* AI-suggested dishes fallback (cuisine pages with no TheMealDB recipes) */}
        {showAiFallback && (
          <div>
            {loadingSuggestions && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-4" />
                <p className="text-stone-500">
                  Our database doesn&apos;t have {displayName} recipes yet —
                  asking AI for some authentic dishes...
                </p>
              </div>
            )}

            {!loadingSuggestions && suggestions.length > 0 && (
              <div>
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-stone-700">
                    We don&apos;t have {displayName} recipes in our database
                    yet, so here are AI-suggested authentic dishes. Click one
                    to generate the full recipe.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {suggestions.map((dish) => (
                    <button
                      key={dish.name}
                      onClick={() => handleGenerateDish(dish.name)}
                      disabled={generatingDish !== null}
                      className="text-left bg-white border-2 border-stone-200 hover:border-orange-400 hover:bg-orange-50 rounded-xl p-5 transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-stone-900">
                          {dish.name}
                        </h3>
                        {generatingDish === dish.name ? (
                          <Loader2 className="w-4 h-4 text-orange-600 animate-spin flex-shrink-0" />
                        ) : (
                          <ChefHat className="w-4 h-4 text-orange-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-stone-500">
                        {dish.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingSuggestions && suggestions.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className="text-2xl font-bold text-stone-900 mb-2">
                  No recipes found
                </h3>
                <p className="text-stone-500 mb-6">
                  We couldn&apos;t find any {displayName} dishes right now.
                </p>
                <Link href={backLink}>
                  <span className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold">
                    <ArrowLeft className="w-4 h-4" />
                    Go back to explore more
                  </span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Empty state for category pages (no AI fallback needed there) */}
        {!loading && type !== "cuisine" && meals.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              No recipes found
            </h3>
            <p className="text-stone-500 mb-6">
              We couldn&apos;t find any {displayName} recipes.
            </p>
            <Link href={backLink}>
              <span className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold">
                <ArrowLeft className="w-4 h-4" />
                Go back to explore more
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
