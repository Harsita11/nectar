"use client";

import { useParams } from "next/navigation";
import RecipeGrid from "@/components/RecipeGrid";
import { getMealsByArea } from "@/actions/mealdb.actions";

function slugToAreaName(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CuisineRecipesPage() {
  const params = useParams();
  const cuisine = slugToAreaName(params.cuisine);

  return (
    <RecipeGrid
      type="cuisine"
      value={cuisine}
      fetchAction={getMealsByArea}
      backLink="/dashboard"
    />
  );
}
