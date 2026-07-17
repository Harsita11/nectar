/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ShoppingCart,
  CalendarDays,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import useFetch from "@/hooks/use-fetch";
import {
  getMealPlans,
  addMealToDay,
  removeMealFromDay,
  generateShoppingList,
} from "@/actions/mealplan.actions";
import { getSavedRecipes } from "@/actions/recipe.actions";
import { toast } from "sonner";
import Link from "next/link";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

// --- Date helpers (no external date library needed) ---------------------

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekOffset) {
  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { date, mealType }
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const startDate = toISODate(weekDays[0]);
  const endDate = toISODate(weekDays[6]);

  const { loading: loadingPlans, data: plansData, fn: fetchPlans } =
    useFetch(getMealPlans);
  const { loading: loadingSaved, data: savedData, fn: fetchSaved } =
    useFetch(getSavedRecipes);
  const { loading: adding, data: addData, fn: addMeal } = useFetch(addMealToDay);
  const { loading: removing, data: removeData, fn: removeMeal } =
    useFetch(removeMealFromDay);
  const {
    loading: loadingShoppingList,
    data: shoppingData,
    fn: fetchShoppingList,
  } = useFetch(generateShoppingList);

  useEffect(() => {
    fetchPlans(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useEffect(() => {
    if (addData?.success) {
      toast.success(addData.message);
      setPickerOpen(false);
      fetchPlans(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addData]);

  useEffect(() => {
    if (removeData?.success) {
      toast.success(removeData.message);
      fetchPlans(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeData]);

  const mealPlans = plansData?.mealPlans || [];

  const getMealsFor = (date, mealType) => {
    const iso = toISODate(date);
    return mealPlans.filter(
      (mp) => mp.date === iso && mp.mealType === mealType
    );
  };

  const openPicker = (date, mealType) => {
    setPickerTarget({ date: toISODate(date), mealType });
    setPickerOpen(true);
    fetchSaved();
  };

  const handlePickRecipe = (recipeId) => {
    const formData = new FormData();
    formData.append("recipeId", recipeId);
    formData.append("date", pickerTarget.date);
    formData.append("mealType", pickerTarget.mealType);
    addMeal(formData);
  };

  const handleRemove = (mealPlanId) => {
    const formData = new FormData();
    formData.append("mealPlanId", mealPlanId);
    removeMeal(formData);
  };

  const handleOpenShoppingList = () => {
    setShoppingOpen(true);
    setCheckedItems({});
    fetchShoppingList(startDate, endDate);
  };

  const toggleChecked = (key) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-orange-600" />
              Meal Planner
            </h1>
            <p className="text-stone-600 font-light mt-1">
              Plan your week, then generate a shopping list in one click.
            </p>
          </div>
          <Button
            onClick={handleOpenShoppingList}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-2 self-start sm:self-auto"
          >
            <ShoppingCart className="w-4 h-4" />
            Generate Shopping List
          </Button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6 bg-white border-2 border-stone-200 p-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="border-2 border-stone-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center font-bold text-stone-900">
            {formatDateLabel(weekDays[0])} – {formatDateLabel(weekDays[6])}
            {weekOffset === 0 && (
              <Badge className="ml-2 bg-orange-100 text-orange-700 border-none">
                This week
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="border-2 border-stone-300"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px] grid grid-cols-[100px_repeat(7,1fr)] gap-2">
            {/* Day headers */}
            <div />
            {weekDays.map((d) => (
              <div key={toISODate(d)} className="text-center pb-2">
                <div className="font-bold text-stone-900">
                  {formatDayLabel(d)}
                </div>
                <div className="text-xs text-stone-500">
                  {formatDateLabel(d)}
                </div>
              </div>
            ))}

            {/* Meal rows */}
            {MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="contents">
                <div className="flex items-center font-bold text-sm text-stone-500 uppercase tracking-wide">
                  {MEAL_LABELS[mealType]}
                </div>
                {weekDays.map((d) => {
                  const meals = getMealsFor(d, mealType);
                  return (
                    <div
                      key={toISODate(d) + mealType}
                      className="bg-white border-2 border-stone-200 min-h-[90px] p-2 flex flex-col gap-1.5"
                    >
                      {meals.map((mp) => (
                        <div
                          key={mp.id}
                          className="group relative bg-orange-50 border border-orange-200 rounded px-2 py-1.5 text-xs"
                        >
                          <Link
                            href={`/recipe?id=${mp.recipe?.id}`}
                            className="font-semibold text-stone-800 hover:text-orange-700 line-clamp-2 pr-4 block"
                          >
                            {mp.recipe?.title || "Untitled recipe"}
                          </Link>
                          <button
                            onClick={() => handleRemove(mp.id)}
                            disabled={removing}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-red-600"
                            aria-label="Remove from plan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => openPicker(d, mealType)}
                        className="flex-1 flex items-center justify-center text-stone-300 hover:text-orange-600 hover:bg-orange-50/50 rounded transition-colors min-h-[28px]"
                        aria-label={`Add ${mealType} for ${formatDateLabel(
                          d
                        )}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {loadingPlans && (
          <div className="flex justify-center mt-6 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
      </div>

      {/* Recipe picker modal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a recipe</DialogTitle>
            <DialogDescription>
              Choose from your saved recipes to add to this slot.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {loadingSaved && (
              <div className="flex justify-center py-6 text-stone-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loadingSaved && savedData?.recipes?.length === 0 && (
              <p className="text-sm text-stone-500 text-center py-6">
                You haven&apos;t saved any recipes yet.{" "}
                <Link href="/recipes" className="text-orange-600 underline">
                  Browse recipes
                </Link>{" "}
                to add some.
              </p>
            )}

            {savedData?.recipes?.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => handlePickRecipe(recipe.id)}
                disabled={adding}
                className="w-full text-left px-4 py-3 border-2 border-stone-200 hover:border-orange-400 hover:bg-orange-50 rounded transition-colors flex items-center justify-between gap-2"
              >
                <span className="font-medium text-stone-800">
                  {recipe.title}
                </span>
                {adding && (
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shopping list modal */}
      <Dialog open={shoppingOpen} onOpenChange={setShoppingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
              Shopping List
            </DialogTitle>
            <DialogDescription>
              {formatDateLabel(weekDays[0])} – {formatDateLabel(weekDays[6])}
              {shoppingData?.recipeCount != null &&
                ` · from ${shoppingData.recipeCount} planned recipe${
                  shoppingData.recipeCount === 1 ? "" : "s"
                }`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-5">
            {loadingShoppingList && (
              <div className="flex justify-center py-8 text-stone-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loadingShoppingList &&
              shoppingData?.shoppingList &&
              Object.keys(shoppingData.shoppingList).length === 0 && (
                <p className="text-sm text-stone-500 text-center py-8">
                  No recipes planned for this week yet — add some meals first.
                </p>
              )}

            {shoppingData?.shoppingList &&
              Object.entries(shoppingData.shoppingList).map(
                ([category, items]) => (
                  <div key={category}>
                    <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">
                      {category}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => {
                        const key = `${category}-${item.item}-${i}`;
                        const checked = !!checkedItems[key];
                        return (
                          <li key={key}>
                            <button
                              onClick={() => toggleChecked(key)}
                              className="w-full flex items-center gap-3 text-left py-1"
                            >
                              <span
                                className={`w-5 h-5 flex-shrink-0 border-2 rounded flex items-center justify-center ${
                                  checked
                                    ? "bg-orange-600 border-orange-600"
                                    : "border-stone-300"
                                }`}
                              >
                                {checked && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </span>
                              <span
                                className={`flex-1 text-sm ${
                                  checked
                                    ? "line-through text-stone-400"
                                    : "text-stone-700"
                                }`}
                              >
                                {item.item}
                              </span>
                              <span className="text-xs font-semibold text-orange-600 whitespace-nowrap">
                                {item.amount}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}